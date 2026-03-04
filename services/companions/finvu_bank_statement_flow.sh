#!/usr/bin/env bash
set -euo pipefail

# Requires: curl, jq, date

# --------- Config (pre-filled from your working setup) ----------
LOGIN_URL="https://rpnfintralease.fiulive.finfactor.co.in/finsense/API/V2/User/Login"
CONSENT_URL="https://rpnfintralease.fiulive.finfactor.co.in/finsense/API/V2/ConsentRequestPlus"
FIREQUEST_URL="https://rpnfintralease.fiulive.finfactor.co.in/finsense/API/V2/FIRequest"
CHANNEL_ID="fiulive@fintralease"
USER_ID="channel@fintralease"
PASSWORD="27dba773fc7f43e899a3a8faf9af4bdf"
AA_ID="cookiejaraalive@finvu"
TEMPLATE_NAME="BANK_STATEMENT_ONETIME"
REDIRECT_URL="https://app.credflow.in/account-aggregation/status?orgId=1244&rm_token=token"
CONSENT_DESCRIPTION="Consent for Account Aggregation"
USER_SESSION_ID=123

# Defaults (can be overridden via flags)
MOBILE_NUMBER="7838237658"
DAYS_BACK=181
OUTPUT_FORMAT="json" # json|xml|pdf
OUTPUT_FILE=""
POLL_SECONDS=3
MAX_POLL_ATTEMPTS=40

usage() {
  cat <<'EOF'
Usage:
  ./finvu_bank_statement_flow.sh [options]

Options:
  --mobile <10digit>           Mobile number (default: 9810254998)
  --days-back <n>              Lookback days from today (default: 182 ~ 6 months)
  --from <YYYY-MM-DD>          Custom from date (overrides --days-back)
  --to <YYYY-MM-DD>            Custom to date (default: today if --from is used)
  --format <json|xml|pdf>      FIDataFetch output format (default: json)
  --out <file>                 Output file path (default auto-generated)
  --poll-seconds <n>           Poll interval for status checks (default: 3)
  --max-polls <n>              Max poll attempts (default: 40)
  --help                       Show this help

Example:
  ./finvu_bank_statement_flow.sh --mobile 9810254998 --days-back 182 --format json
EOF
}

FROM_DATE=""
TO_DATE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mobile) MOBILE_NUMBER="${2:?missing value}"; shift 2 ;;
    --days-back) DAYS_BACK="${2:?missing value}"; shift 2 ;;
    --from) FROM_DATE="${2:?missing value}"; shift 2 ;;
    --to) TO_DATE="${2:?missing value}"; shift 2 ;;
    --format) OUTPUT_FORMAT="${2:?missing value}"; shift 2 ;;
    --out) OUTPUT_FILE="${2:?missing value}"; shift 2 ;;
    --poll-seconds) POLL_SECONDS="${2:?missing value}"; shift 2 ;;
    --max-polls) MAX_POLL_ATTEMPTS="${2:?missing value}"; shift 2 ;;
    --help) usage; exit 0 ;;
    *) echo "Unknown arg: $1"; usage; exit 1 ;;
  esac
done

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required."
  exit 1
fi

if [[ "$OUTPUT_FORMAT" != "json" && "$OUTPUT_FORMAT" != "xml" && "$OUTPUT_FORMAT" != "pdf" ]]; then
  echo "Error: --format must be one of json|xml|pdf"
  exit 1
fi

if [[ -z "$FROM_DATE" ]]; then
  FROM_DATE="$(date -v-"$DAYS_BACK"d +%Y-%m-%d)"
fi
if [[ -z "$TO_DATE" ]]; then
  TO_DATE="$(date +%Y-%m-%d)"
fi

# API expects +0530 style offset; using IST by default as discussed.
DATE_TIME_FROM="${FROM_DATE}T00:00:00.000+0530"
DATE_TIME_TO="${TO_DATE}T23:59:59.000+0530"
CUST_ID="${MOBILE_NUMBER}@finvu"

RID() { uuidgen | tr 'A-Z' 'a-z'; }
TS() { date -u +"%Y-%m-%dT%H:%M:%S.000Z"; }

echo "Starting Finvu flow for ${CUST_ID}"
echo "Date range: ${DATE_TIME_FROM} -> ${DATE_TIME_TO}"

# 1) Login
LOGIN_RESP="$(curl -sS --location "$LOGIN_URL" \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  --data "$(jq -n \
    --arg rid "$(RID)" \
    --arg ts "$(TS)" \
    --arg channelId "$CHANNEL_ID" \
    --arg userId "$USER_ID" \
    --arg password "$PASSWORD" \
    '{header:{rid:$rid,ts:$ts,channelId:$channelId},body:{userId:$userId,password:$password}}')")"

TOKEN="$(printf '%s' "$LOGIN_RESP" | jq -r '.body.token // empty')"
if [[ -z "$TOKEN" ]]; then
  echo "Login failed:"
  echo "$LOGIN_RESP" | jq .
  exit 1
fi
echo "Login successful."

# 2) ConsentRequestPlus
CONSENT_RESP="$(curl -sS --location "$CONSENT_URL" \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  --header "Authorization: Bearer $TOKEN" \
  --data "$(jq -n \
    --arg rid "$(RID)" \
    --arg ts "$(TS)" \
    --arg channelId "$CHANNEL_ID" \
    --arg custId "$CUST_ID" \
    --arg consentDescription "$CONSENT_DESCRIPTION" \
    --arg templateName "$TEMPLATE_NAME" \
    --argjson userSessionId "$USER_SESSION_ID" \
    --arg redirectUrl "$REDIRECT_URL" \
    --arg aaId "$AA_ID" \
    '{
      header:{rid:$rid,ts:$ts,channelId:$channelId},
      body:{
        custId:$custId,
        consentDescription:$consentDescription,
        templateName:$templateName,
        userSessionId:$userSessionId,
        redirectUrl:$redirectUrl,
        fip:[""],
        ConsentDetails:{},
        aaId:$aaId
      }
    }')")"

CONSENT_HANDLE="$(printf '%s' "$CONSENT_RESP" | jq -r '.body.ConsentHandle // empty')"
ONBOARDING_URL="$(printf '%s' "$CONSENT_RESP" | jq -r '.body.url // empty')"
if [[ -z "$CONSENT_HANDLE" || -z "$ONBOARDING_URL" ]]; then
  echo "ConsentRequestPlus failed:"
  echo "$CONSENT_RESP" | jq .
  exit 1
fi

echo
echo "Consent handle: $CONSENT_HANDLE"
echo "Open this URL and complete OTP + data sharing approval:"
echo "$ONBOARDING_URL"
echo
read -r -p "Press Enter after approval is completed..."

# 3) Consent status poll until ACCEPTED
CONSENT_ID=""
for ((i=1; i<=MAX_POLL_ATTEMPTS; i++)); do
  STATUS_RESP="$(curl -sS --location "https://rpnfintralease.fiulive.finfactor.co.in/finsense/API/V2/ConsentStatus/${CONSENT_HANDLE}/${CUST_ID}" \
    --header 'Content-Type: application/json' \
    --header 'Accept: application/json' \
    --header "Authorization: Bearer $TOKEN")"
  CONSENT_STATUS="$(printf '%s' "$STATUS_RESP" | jq -r '.body.consentStatus // empty')"
  CONSENT_ID="$(printf '%s' "$STATUS_RESP" | jq -r '.body.consentId // empty')"
  echo "Consent poll $i/$MAX_POLL_ATTEMPTS: status=$CONSENT_STATUS consentId=${CONSENT_ID:-null}"
  if [[ "$CONSENT_STATUS" == "ACCEPTED" && -n "$CONSENT_ID" && "$CONSENT_ID" != "null" ]]; then
    break
  fi
  sleep "$POLL_SECONDS"
done

if [[ -z "$CONSENT_ID" || "$CONSENT_ID" == "null" ]]; then
  echo "Consent not accepted within polling window."
  exit 1
fi

# 4) FIRequest
FIREQ_RESP="$(curl -sS --location "$FIREQUEST_URL" \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  --header "Authorization: Bearer $TOKEN" \
  --data "$(jq -n \
    --arg rid "$(RID)" \
    --arg ts "$(TS)" \
    --arg channelId "$CHANNEL_ID" \
    --arg custId "$CUST_ID" \
    --arg consentHandleId "$CONSENT_HANDLE" \
    --arg consentId "$CONSENT_ID" \
    --arg dateTimeRangeFrom "$DATE_TIME_FROM" \
    --arg dateTimeRangeTo "$DATE_TIME_TO" \
    '{header:{rid:$rid,ts:$ts,channelId:$channelId},body:{custId:$custId,consentHandleId:$consentHandleId,consentId:$consentId,dateTimeRangeFrom:$dateTimeRangeFrom,dateTimeRangeTo:$dateTimeRangeTo}}')")"

SESSION_ID="$(printf '%s' "$FIREQ_RESP" | jq -r '.body.sessionId // empty')"
if [[ -z "$SESSION_ID" ]]; then
  echo "FIRequest failed:"
  echo "$FIREQ_RESP" | jq .
  exit 1
fi
echo "FIRequest created sessionId=$SESSION_ID"

# 5) FIStatus poll until READY
FI_STATUS=""
for ((i=1; i<=MAX_POLL_ATTEMPTS; i++)); do
  FISTATUS_RESP="$(curl -sS --location "https://rpnfintralease.fiulive.finfactor.co.in/finsense/API/V2/FIStatus/${CONSENT_ID}/${SESSION_ID}/${CONSENT_HANDLE}/${CUST_ID}" \
    --header 'Accept: application/json' \
    --header "Authorization: Bearer $TOKEN")"
  FI_STATUS="$(printf '%s' "$FISTATUS_RESP" | jq -r '.body.fiRequestStatus // empty')"
  echo "FI status poll $i/$MAX_POLL_ATTEMPTS: $FI_STATUS"
  if [[ "$FI_STATUS" == "READY" ]]; then
    break
  fi
  sleep "$POLL_SECONDS"
done

if [[ "$FI_STATUS" != "READY" ]]; then
  echo "FI data not ready within polling window."
  exit 1
fi

# 6) FIDataFetch
ACCEPT_HEADER="application/json"
EXT="json"
if [[ "$OUTPUT_FORMAT" == "xml" ]]; then
  ACCEPT_HEADER="application/xml"
  EXT="xml"
elif [[ "$OUTPUT_FORMAT" == "pdf" ]]; then
  ACCEPT_HEADER="application/pdf"
  EXT="pdf"
fi

if [[ -z "$OUTPUT_FILE" ]]; then
  OUTPUT_FILE="finvu_${MOBILE_NUMBER}_${FROM_DATE}_to_${TO_DATE}.${EXT}"
fi

curl -sS --location "https://rpnfintralease.fiulive.finfactor.co.in/finsense/API/V2/FIDataFetch/${CONSENT_HANDLE}/${SESSION_ID}" \
  --header "Accept: ${ACCEPT_HEADER}" \
  --header "Authorization: Bearer $TOKEN" \
  --output "$OUTPUT_FILE"

echo
echo "Success."
echo "custId: ${CUST_ID}"
echo "consentHandleId: ${CONSENT_HANDLE}"
echo "consentId: ${CONSENT_ID}"
echo "sessionId: ${SESSION_ID}"
echo "output: ${OUTPUT_FILE}"

if [[ "$OUTPUT_FORMAT" == "json" ]]; then
  echo "JSON quick summary:"
  jq '{header, body_count:(.body|length)}' "$OUTPUT_FILE" || true
fi