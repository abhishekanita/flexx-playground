flag: 'GET_ACCOUNT_STATEMENT',
sub_flag: 'CAMSKARVYFTAMILSBFS',
user_id: req.email,
password: req.password,
from_date: this.formatDate(req.fromDate),
to_date: this.formatDate(req.toDate),
email_id: req.email,
statement_type: req.statementType,
login_type: 'EMAIL',
service_code: 'INVACCCAMSKARVY',
zero_bal_folio: 'Y',
pan: req.pan.toUpperCase(),
request_flag: 'CF',
session_id: sessionId,
checkfieldtouched: 'EMAIL$PWD$CPWD$',
            checkfieldpristine: 'EMAIL$PWD$CPWD$',
recaptchatoken: recaptchaToken,
application: 'CAMSONLINE',
sub_application: 'CAMSONLINE',
browser: 'Chrome',
device_id: '144.0.0.0',
os_id: 'mac-os-x-15',
deviceid: 'desktop',
page_name: CamsPlugin.PAGE,

================================================================================

## https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement

================================================================================

> > > REQUEST #1 (decrypted):
> > > {
> > > "flag": "GET_ACCOUNT_STATEMENT_SESSION",
> > > "email_id": "abhishek12318@gmail.com",
> > > "user_id": "abhishek12318@gmail.com",
> > > "service_code": "INVACCCAMSKARVY",
> > > "login_type": "EMAIL",
> > > "checkfieldtouched": "EMAIL$",
  "checkfieldpristine": "EMAIL$",
> > > "application": "CAMSONLINE",
> > > "sub_application": "CAMSONLINE",
> > > "browser": "Chrome",
> > > "device_id": "144.0.0.0",
> > > "os_id": "mac-os-x-15",
> > > "deviceid": "desktop",
> > > "page_name": "/Investors/Statements/Consolidated-Account-Statement"
> > > }

---

> > > REQUEST #2 (decrypted):
> > > [DECRYPT FAILED] error:1C80006B:Provider routines::wrong final block length

================================================================================

## https://www.camsonline.com/Investors/Statements/CAS-CAMS

================================================================================

> > > REQUEST #1 (decrypted):
> > > [DECRYPT FAILED] error:1C80006B:Provider routines::wrong final block length

<<< RESPONSE #1 (decrypted):
[DECRYPT FAILED] error:1C80006B:Provider routines::wrong final block length

================================================================================

## https://www.camsonline.com/Investors/Statements/Portfolio-Valuation-Statement

================================================================================

> > > REQUEST #1 (decrypted):
> > > {
> > > "flag": "GET*ACCOUNT_STATEMENT",
> > > "sub_flag": "PORTFOLIO",
> > > "email_id": "abhishek12318@gmail.com",
> > > "user_id": "abhishek12318@gmail.com",
> > > "password": "12345678@",
> > > "amc_code": "IF,B,AO,G,CHS,D,FTI,H,HLS,O,P,JIO,K,MM,PLF,PP,L,SH,T,TMF,UFI,UK,Y,Z",
> > > "pan": "",
> > > "delivery_option": "SENDATTACH",
> > > "login_type": "EMAIL",
> > > "service_code": "INVACCPORTFOLIO",
> > > "session_id": "MGIhjl4Xu17w96uVQO9uWv6pbg4wftWDZBqS-yAtH2wQw6m4qH0R5O-uPZlJaDY-",
> > > "saveformat": "JSON",
> > > "recaptchatoken": "0cAFcWeA4G0mf4Gu5brBYFbZMDjmFsNFJVy3b-ckLOQ3YawgkjJxSZIcxhLKYeY2k6GDd1mrQ73LF35sxzUzivZTGGLLOeIdFSGg9WjFsnA1O--QviGZ5tVorSO8GdgncQ8KOweiUMRTCvzgwSqstxkh35X27syUntR8LLwKM75DHbmB4rjL8IjOn3jqHUTa394pWvuUBlivxQTzCKuxmDo9AfCP4j351tiHxc4qSV6c-hPuWrJhXDnRIAdGyZWKNdH446WsMNk3layawgsT4arRcYMeJB2M9wj5nWEcpaVBeW-ZoAvoNXtMIdMHb-M60wvx22fleKsSldVESSEdOAKJEmADnX2hV_YM4QdH6dfZOG4Z93njjZStcZ7wWZ6e4Fw4uJSN75S7w7wKKj-TnAtyyOJhsYo5AmdEx5mL8WOQAzJfAciuyt2hReQgq-0KLD*-GKYMLkLfA8vZOx-jyUTRuTJjXo9q19CUYdMZk6NMVsYaJkgOYIjFyUHRo0iyNXtYwHgcBPQOxG1g*YshFdvX4jD1Y5s7BP3DzW08lppe7xmR0nx3Z6qsJaMues-ObSs5xWsEWoEbuAiMbJQvlC844svNfboc-i6paUJOO1F7J5x4cZcYMa3zYtTtZ-KcneQY7beb-M6klC-oSkKFU7eJpvH-F9uifAL5VtMVPx6cVqUkFliWKSO6BtayjPEMViCJI0EUuaj8qkd--e7BkcElhs4zedByhgHu1kHaeCcovDNUi1OPo1X0oQjIDWhKqaQGaoTPrnyGE9_CETO04DojJaKjBBQNe4H-kSJRmVpafpJELx9CLg1iMcbbPMQkTHls1Iw5RpXgem7a_L4OaNgPyO91can2o30Zk9f51Hht5wJUV3s_2PzkhdBToKvUiocK9ysbed130o-eownZb3mjRtKCKHx7qLlJJWp3-45aa0GO652rKBMAUcF5OWJKcJg7HSgj6mzcQsH9alzFIaALj3yDyto9RqR_Cn-5*-lKyhFz6Aqy_JZsWkUmO5-l_d_verrwk3JDfeKRT3EVzjlZs5u337UZKrSErEofHCpIKZj7n9Zs5xNcMRLvI8vMJbDOHHRaONOK87MOXBx63tHX37375WI7WWlvhXCUovoDlf6v9ZEuDKf83j8JYem3knZLNY--8G2dy52wPm3N4uJkXUNekpmF12wG_iR5k1U0uubxB7c3DRsz2hRhFmyrkx-bAjY_fyC6b15Q2ZSKQX2dJU6MOULn65SlEezw6DfdsAg_pjOmyLZvUOrMQYH24UpwIWEfPZ8lqRNH2pfl4LythT3XG6WxlPtP5qR4CS_1QJuDs89dbwQP62X229uXlaNKhoJWdoTj-i38g56WfgT7qDy3OTWzVomxJUWQr_DJihlDkaMQzJvLOlO0VEI5ven75tm1rVUUFNCTK-5kRRMA-f01zrSj3SrH4IWln_vWEK8SSffhYtblstqToZRrB9JQOUQv2yMsN42VsNRwrC2KVT-Vk3fMNbZhCjlEz3c9TRaRtJA6QTdqFZzq3QU-iX0W-k2wPnrMlRpdid320fTWyk\_\_xqPDLIc4JUrf3q9LrP54wqmWmwoUfuSFChCVxH0lc9yTv5SfXEWeGWYLZ5iuEz6d-Wwobl225Djf3HT419qBgl0ysBsjd8GNJ-jrb0HLyq9JKDGl-TVMJGPjy--ODByrwl3iDfVb2XdCrW0wJ6zqAdMZIDUAZ3O_T7f7wNfv41gdTbrz2rXBomiOUCkj5coUJ6d9w-svKfZgc7oFGmdQe04m5ScYrL7UzciP54szu9yPDUGnZBtMlBcgMg80DqZDYiUY0DCcxWlvGVX3dfWtnKQO5PrJC-reAzeM_pftlfbgjbpYNqFdCCPhtQUnooflLA0qpjzlXaw6xInCTxsggdotSJuPIOyihn1_WwNuN2lhA0fI5djNlGZRP69pasHFrbeVQJ1y_mcZ3E8RozjAvVpKf4zFA5KmVrNrhIsrcVm-KaJcCcmpSvvG6eAE1wRjrQD-akO0e46WFQawreFzKgQYd6r54C0ig884J_TMfKfRvcsBEo-4X_9lzZ2pDtP4wIwK4PeZvfsm-dZtzCjKsQ-cFbIHxOKeLB07KooXADEgVKlglXM9rqjNbHDkrqJw4tcveKuBovM2MnqYCSJZkelM6NTbtLZ7ROJD8nAriQYqlk-RktDjRiug2KCB0P6Ozm-TZ3BS_Ctrl2mqQjjJOkM0j2yUhIqoaBI3mulY_kPL8O28wEtjKQQJMdqPFfNlBHo1FSoA",
> > > "application": "CAMSONLINE",
> > > "sub_application": "CAMSONLINE",
> > > "browser": "Chrome",
> > > "device_id": "144.0.0.0",
> > > "os_id": "mac-os-x-15",
> > > "deviceid": "desktop",
> > > "page_name": "/Investors/Statements/Portfolio-Valuation-Statement"
> > > }

<<< RESPONSE #1 (decrypted):
{
"status": {
"errorflag": false,
"errorcode": "",
"errormsg": "",
"version": "1.0",
"captcha_validation": "",
"captcha_score": "",
"resdatetime": "2/26/2026, 12:00:00 AM 168_36_195"
},
"detail": {
"MESSAGE": "Your Portfolio Valuation Statement will be sent to your registered email id abhishek12318@gmail.com. Your reference number is PF205607551.",
"REF_NO": "PF205607551",
"TITLE": "Portfolio Valuation Statement",
"QUOTA_EXCEED": "N"
},
"captcha_data": {
"success": true,
"challenge_ts": "2026-02-26T10:29:27Z",
"hostname": "www.camsonline.com",
"score": 0.6,
"action": "GET_ACCOUNT_STATEMENT"
}
}

================================================================================

## https://www.camsonline.com/Investors/Statements/Active-Statement

================================================================================

> > > REQUEST #1 (decrypted):
> > > [DECRYPT FAILED] error:1C80006B:Provider routines::wrong final block length

<<< RESPONSE #1 (decrypted):
{
"status": {
"errorflag": false,
"errorcode": "",
"errormsg": "SUCCESS",
"version": "1.0",
"captcha_validation": "",
"captcha_score": "",
"resdatetime": "2/26/2026, 12:00:00 AM 168_36_195"
},
"detail": {
"session_id": "A2KHIbJu8SiEpmL9H68bYH_ZsEKKyOnRddSlRz1bSrtVgRuO9IFz4Bj9hN8AidZg",
"user_id": "abhishek12318@gmail.com"
},
"detail1": [
{
"AMC_CODE": "B",
"AMC_NAME": "Aditya Birla Sun Life Mutual Fund",
"SIF_ENABLE": null
},
{
"AMC_CODE": "H",
"AMC_NAME": "HDFC Mutual Fund",
"SIF_ENABLE": null
},
{
"AMC_CODE": "P",
"AMC_NAME": "ICICI Prudential Mutual Fund",
"SIF_ENABLE": null
},
{
"AMC_CODE": "L",
"AMC_NAME": "SBI Mutual Fund",
"SIF_ENABLE": null
}
],
"detail2": []
}

---

> > > REQUEST #2 (decrypted):
> > > [DECRYPT FAILED] error:1C80006B:Provider routines::wrong final block length

<<< RESPONSE #2 (decrypted):
[DECRYPT FAILED] error:1C80006B:Provider routines::wrong final block length

================================================================================

## https://www.camsonline.com/Investors/Statements/Capital-Gain&Capital-Loss-statement

================================================================================

> > > REQUEST #1 (decrypted):
> > > [DECRYPT FAILED] error:1C80006B:Provider routines::wrong final block length

================================================================================

## https://www.camsonline.com/Investors/Statements/Transaction-Details-Statement

================================================================================

> > > REQUEST #1 (decrypted):
> > > {
> > > "flag": "GET*ACCOUNT_STATEMENT",
> > > "sub_flag": "CTRANSACTIONSDETAILS",
> > > "from_date": "01-Apr-2025",
> > > "to_date": "26-Feb-2026",
> > > "email_id": "abhishek12318@gmail.com",
> > > "user_id": "abhishek12318@gmail.com",
> > > "password": "12345678@",
> > > "amc_code": "IF,B,AO,G,CHS,D,FTI,H,HLS,O,P,JIO,K,MM,PLF,PP,L,SH,T,TMF,UFI,UK,Y,Z",
> > > "pan": "",
> > > "foliono": "",
> > > "login_type": "EMAIL",
> > > "service_code": "INVACCTRXNDET",
> > > "session_id": "1SOARXepD-6ND7gT-BGd7oWE6SNWe-i_nDjAPcmenywXDPBYbnn-z-vqLPOGlibD",
> > > "saveformat": "JSON",
> > > "recaptchatoken": "0cAFcWeA7ctpd8lOZQjOMGS0revhTi3Y3CZMflmHoaQz3htvAz3Q44YGv3GV0myTUuF-5qNfkdoEs5U\_\_BdR3ilZ6pfWk4w0TsAXxU-AXjRy5IZolgBmndcvAOzdq_M_kYnOuhe39TDPxK2czkq79FsCO1umCg8ELzyloXx-qN3bj0SytAeKZAtEA0G_zWO7hcw20KYFswThsv8RoDNq-dYOsnCOFN6iMJaqeghdj0jXyOP7Gd84b1K0eQK8FaGd6W0M0XTyKoiXQ1-nFRiwnyRhTMMGF7prIwptzu-Z9MuoEBTCA4LuDJ0Lp9HmSDMTi0C1Bb0BWJFkwFKNrblwIZOOK4btjkzFlzkgDeU3VU2AsnsvpK-y5sEx715eST1MngRB0Wj06g-YfjRm9aaiwQsJRfEUTZJWR_7wG1adk1F_UXLWvcuHlirkV8JTcpvRUiXxrM39HoHqGMAxzxB8eooz_I9gCnm48jvVBq2iOO4dOqXrEK9TnZypVuVUjchJ5dtDXaM3-i-TbPD_LmssqwmRJJBlNPSUECU8_Qa3XbDA4_w3StSoHzcCDXNW1tKjnVbxoS35FCkXOIXg9beBymQN_4EcN9aQcFicqWMTWs4hQtU1im--BEBLRvN288lyk1jk9OWFWElwHY3B3edgsKLkl51C1zDlA7x-PXqFrL_J08gMXycIZtl1YGViAQHstIRU8xKnCKlsmXsuEmOkaWR1dNM0mK8DSY9Sj6tfvm7ArOgIQhmknRxfMliv6JHfHupLyoWi5_Qz2mod0FbIJll7a9h92-n_m1BTY7ej0ZyUvUdoMmTPCJHruB32bp4SJM6PuunrcnUjVvYeOsoCpQPwKpDUp33dPhCdcCfSTxAuiw5sDVQ-bQuRR8NfQGNXOeWJWqGHEqlJXK-jzvPzmrhn2cvgHh9Lwes9Nxm_IqSEcjdtc9G9BTi80159KsBfMFaN-s828sIlgDKGCG2GyJ9yflEuHT0gEc3E_zrKtUSfVGzhYuz1qHe5lXi1Aoe8USbXX_cPPl3mCNvU8ZIIImYikMJ1b5ErB7Cx8kYsJzErTpUXF4SrN0e8AjPq5ubj_lFq2fyhzuMlqVysxFU8TypG1Y3XRv3T78V-JO_2iyOcwbNSqx4baV0UfAFv3w0UmetsJW3yqlaEvFvLZdg_VbM4dO7olviA-JRq73jsouW5q2B8bOFk4B69T4Skt8BcpI_oGVb2i7TEvUA8EgkDDzdNNYEkdQASpDKYTEWLUWL0D04MYtBiUSv8k4cGf_zsF8Xi3UQGY1ZZeyDlSOvaNZna8EckpvKUHtnzlLvpxboc4JDPolxiFDSozFW61mO-yWLroKRFlZ6wm9P5jlXOa3f0PoQpDKqmgYpNUSNMLOgbo99dUqOkvKHMMZVmLQ4q-75kaWm6r8k60BuxAfHYI_Fvn_vIzBUbjVYvaXt2EHkRigTnX_SxgHAsH2eaQRWS55forqDcCYXGGcGISmH-AzhCS3BpFD5B7doy8iqeg7cd_FSLeJC_NrEngZ9TLI7L8vfNR1BEghxOhBa_TkYCxOznD38FVh29JKP0Rws0oqUAB1ZgYGl8UJ62D4GGZa7TQ_1x5euge-LHkYDq--hk00VLpZQYE2amEnkFfr280ANCKoZpU6InHAQCSyNJrHUB6cwTk-SiYQRoUZTqt5mOEujA8_rCAwe2WFxFwbqIRFNC_nzAnUd4GjQeKkNqiGjg9kr2rzOjgoZDT_at02-cp8KT2wAGimJooOZtQXjsb_zfH3l5Pz9hBkUgTXc6S2Y8SGng8Wpr992y7LP70OGnT7X2UbavNxaxh8hxtDt4atzeNOXnATm9a8jEPZy_j44v0mKccVqt6_lTh4uanMeSKuICI8fGPVegTMIujyyU8uiAPCaP0Nmy4q4f*-Hf-dQiXfFUAuUA-w_nsZ-slZ9qbHPKUSedj9KiT3-d_5QVBlst0X3aW9pwuIDjUIx13TI3SHrWV5DSpxOb-roQkv3HD9P-W0XOH_swtEedkxvK8SIejYuznP2szNwzc_IfY0pFD5cnMO3uOjboU4rSDNvAq4goVRIe1BHPBfE6IJ3BF-pxCK9RIR85wNqB8hLNn0jOv1yg7xe3DncLENBwQLFLVCqYgU1uV1tL-C-VaI95CDLXdwn51jZODKq4mzHeOc_DAMgXrQxGjtRUwJhefhMIltBcIyUbnO-4KE1J2gr0k5xwoO4IJ5Om2N3HnXTHcIfXkoGZPDhDmcG7Fy",
> > > "application": "CAMSONLINE",
> > > "sub_application": "CAMSONLINE",
> > > "browser": "Chrome",
> > > "device_id": "144.0.0.0",
> > > "os_id": "mac-os-x-15",
> > > "deviceid": "desktop",
> > > "page_name": "/Investors/Statements/Transaction-Details-Statement"
> > > }

<<< RESPONSE #1 (decrypted):
{
"status": {
"errorflag": false,
"errorcode": "",
"errormsg": "",
"version": "1.0",
"captcha_validation": "",
"captcha_score": "",
"resdatetime": "2/26/2026, 12:00:01 AM 168_36_194"
},
"detail": {
"MESSAGE": "Your Transaction Details Statement will be sent to your registered email id abhishek12318@gmail.com. Your reference number is AS205608377.",
"REF_NO": "AS205608377",
"TITLE": "Transaction Details Statement",
"QUOTA_EXCEED": "N"
},
"captcha_data": {
"success": true,
"challenge_ts": "2026-02-26T11:29:29Z",
"hostname": "www.camsonline.com",
"score": 0.8,
"action": "GET_ACCOUNT_STATEMENT"
}
}

================================================================================

## https://www.camsonline.com/Investors/Statements/Grandfathered-Statement

================================================================================

> > > REQUEST #1 (decrypted):
> > > {
> > > "flag": "GET_ACCOUNT_STATEMENT_SESSION",
> > > "email_id": "abhishek12318@gmail.com",
> > > "user_id": "abhishek12318@gmail.com",
> > > "service_code": "INVACCGRANDFATHERED",
> > > "login_type": "EMAIL",
> > > "checkfieldtouched": "",
> > > "checkfieldpristine": "EMAIL$",
> > > "application": "CAMSONLINE",
> > > "sub_application": "CAMSONLINE",
> > > "browser": "Chrome",
> > > "device_id": "144.0.0.0",
> > > "os_id": "mac-os-x-15",
> > > "deviceid": "desktop",
> > > "page_name": "/Investors/Statements/Grandfathered-Statement"
> > > }

<<< RESPONSE #1 (decrypted):
{
"status": {
"errorflag": false,
"errorcode": "",
"errormsg": "",
"version": "1.0",
"captcha_validation": "",
"captcha_score": "",
"resdatetime": "2/26/2026, 12:00:02 AM 168_36_194"
},
"detail": {
"MESSAGE": "Your Grandfathered Statement for Equity Funds will be sent to your registered email id abhishek12318@gmail.com. Your reference number is CG205608431.",
"REF_NO": "CG205608431",
"TITLE": "Grandfathered Statement for Equity Funds",
"QUOTA_EXCEED": "N"
},
"captcha_data": {
"success": true,
"challenge_ts": "2026-02-26T11:29:29Z",
"hostname": "www.camsonline.com",
"score": 0.7,
"action": "GET_ACCOUNT_STATEMENT"
}
}

---

> > > REQUEST #2 (decrypted):
> > > [DECRYPT FAILED] error:1C80006B:Provider routines::wrong final block length

================================================================================

## https://www.camsonline.com/Investors/Statements/Pay-In&Pay-Out-Statement

================================================================================

> > > REQUEST #1 (decrypted):
> > > {
> > > "flag": "GET_ACCOUNT_STATEMENT_SESSION",
> > > "email_id": "abhishek12318@gmail.com",
> > > "user_id": "abhishek12318@gmail.com",
> > > "service_code": "INVACCPAYINPAYOUT",
> > > "login_type": "EMAIL",
> > > "checkfieldtouched": "EMAIL$",
  "checkfieldpristine": "EMAIL$",
> > > "application": "CAMSONLINE",
> > > "sub_application": "CAMSONLINE",
> > > "browser": "Chrome",
> > > "device_id": "144.0.0.0",
> > > "os_id": "mac-os-x-15",
> > > "deviceid": "desktop",
> > > "page_name": "/Investors/Statements/Pay-In&Pay-Out-Statement"
> > > }

<<< RESPONSE #1 (decrypted):
{
"status": {
"errorflag": false,
"errorcode": "",
"errormsg": "SUCCESS",
"version": "1.0",
"captcha_validation": "",
"captcha_score": "",
"resdatetime": "2/26/2026, 12:00:02 AM 168_36_194"
},
"detail": {
"session_id": "xjoaDAYSUK4gm4wV-urk0ucW-9UukzUx8AvXwjc22WkwBBAzjNY69DYysALsNKPH",
"user_id": "abhishek12318@gmail.com"
},
"detail1": [
{
"AMC_CODE": "B",
"AMC_NAME": "Aditya Birla Sun Life Mutual Fund",
"SIF_ENABLE": null
},
{
"AMC_CODE": "H",
"AMC_NAME": "HDFC Mutual Fund",
"SIF_ENABLE": null
},
{
"AMC_CODE": "P",
"AMC_NAME": "ICICI Prudential Mutual Fund",
"SIF_ENABLE": null
},
{
"AMC_CODE": "L",
"AMC_NAME": "SBI Mutual Fund",
"SIF_ENABLE": null
}
],
"detail2": []
}

---

> > > REQUEST #2 (decrypted):
> > > [DECRYPT FAILED] error:1C80006B:Provider routines::wrong final block length

<<< RESPONSE #2 (decrypted):
{
"status": {
"errorflag": false,
"errorcode": "",
"errormsg": "",
"version": "1.0",
"captcha_validation": "",
"captcha_score": "",
"resdatetime": "2/26/2026, 12:00:02 AM 168_36_194"
},
"detail": {
"MESSAGE": "Your Pay-In Pay-Out Statement will be sent to your registered email id abhishek12318@gmail.com. Your reference number is PP205608639.",
"REF_NO": "PP205608639",
"TITLE": "Pay-In Pay-Out Statement",
"QUOTA_EXCEED": "N"
},
"captcha_data": {
"success": true,
"challenge_ts": "2026-02-26T11:29:29Z",
"hostname": "www.camsonline.com",
"score": 0.7,
"action": "GET_ACCOUNT_STATEMENT"
}
}

================================================================================

## https://www.camsonline.com/Investors/Statements/ELSS-Statement

================================================================================

> > > REQUEST #1 (decrypted):
> > > {
> > > "flag": "GET_ACCOUNT_STATEMENT_SESSION",
> > > "email_id": "abhishek12318@gmail.com",
> > > "user_id": "abhishek12318@gmail.com",
> > > "service_code": "INVACCELSSSTMT",
> > > "login_type": "EMAIL",
> > > "checkfieldtouched": "EMAIL$",
  "checkfieldpristine": "EMAIL$",
> > > "application": "CAMSONLINE",
> > > "sub_application": "CAMSONLINE",
> > > "browser": "Chrome",
> > > "device_id": "144.0.0.0",
> > > "os_id": "mac-os-x-15",
> > > "deviceid": "desktop",
> > > "page_name": "/Investors/Statements/ELSS-Statement"
> > > }

---

> > > REQUEST #2 (decrypted):
> > > [DECRYPT FAILED] error:1C80006B:Provider routines::wrong final block length

================================================================================

## https://www.camsonline.com/Investors/Statements/IDCW-Statement

================================================================================

> > > REQUEST #1 (decrypted):
> > > {
> > > "flag": "GET_ACCOUNT_STATEMENT_SESSION",
> > > "email_id": "abhishek12318@gmail.com",
> > > "user_id": "abhishek12318@gmail.com",
> > > "service_code": "INVACCCONSOLIDATEDSTMT",
> > > "login_type": "EMAIL",
> > > "checkfieldtouched": "EMAIL$",
  "checkfieldpristine": "EMAIL$",
> > > "application": "CAMSONLINE",
> > > "sub_application": "CAMSONLINE",
> > > "browser": "Chrome",
> > > "device_id": "144.0.0.0",
> > > "os_id": "mac-os-x-15",
> > > "deviceid": "desktop",
> > > "page_name": "/Investors/Statements/IDCW-Statement"
> > > }

<<< RESPONSE #1 (decrypted):
{
"status": {
"errorflag": false,
"errorcode": "",
"errormsg": "SUCCESS",
"version": "1.0",
"captcha_validation": "",
"captcha_score": "",
"resdatetime": "2/26/2026, 12:00:02 AM 168_36_194"
},
"detail": {
"session_id": "7eTAIl4EIxfQ_d86kuH9FGxstHNaunZ-azUThSsm1n-lx97h8yaf5uUhcBCGys9N",
"user_id": "abhishek12318@gmail.com"
},
"detail1": [
{
"AMC_CODE": "B",
"AMC_NAME": "Aditya Birla Sun Life Mutual Fund",
"SIF_ENABLE": null
},
{
"AMC_CODE": "H",
"AMC_NAME": "HDFC Mutual Fund",
"SIF_ENABLE": null
},
{
"AMC_CODE": "P",
"AMC_NAME": "ICICI Prudential Mutual Fund",
"SIF_ENABLE": null
},
{
"AMC_CODE": "L",
"AMC_NAME": "SBI Mutual Fund",
"SIF_ENABLE": null
}
],
"detail2": []
}

---

> > > REQUEST #2 (decrypted):
> > > [DECRYPT FAILED] error:1C80006B:Provider routines::wrong final block length

<<< RESPONSE #2 (decrypted):
[DECRYPT FAILED] error:1C80006B:Provider routines::wrong final block length

================================================================================

## https://www.camsonline.com/Investors/Statements/Financial-Transactions

================================================================================

> > > REQUEST #1 (decrypted):
> > > {
> > > "flag": "GET_ACCOUNT_STATEMENT_SESSION",
> > > "email_id": "abhishek12318@gmail.com",
> > > "user_id": "abhishek12318@gmail.com",
> > > "service_code": "INVACCFINTRAN",
> > > "login_type": "EMAIL",
> > > "checkfieldtouched": "",
> > > "checkfieldpristine": "EMAIL$",
> > > "application": "CAMSONLINE",
> > > "sub_application": "CAMSONLINE",
> > > "browser": "Chrome",
> > > "device_id": "144.0.0.0",
> > > "os_id": "mac-os-x-15",
> > > "deviceid": "desktop",
> > > "page_name": "/Investors/Statements/Financial-Transactions"
> > > }

<<< RESPONSE #1 (decrypted):
{
"status": {
"errorflag": false,
"errorcode": "",
"errormsg": "SUCCESS",
"version": "1.0",
"captcha_validation": "",
"captcha_score": "",
"resdatetime": "2/26/2026, 12:00:02 AM 168_36_194"
},
"detail": {
"session_id": "Yrf23rOoMYrXnxOBmpmaHeKi3XWn3KQPzM5W1RXFTJbhKxBGCRBzsJceL8VfFHFl",
"user_id": "abhishek12318@gmail.com"
},
"detail1": [
{
"AMC_CODE": "B",
"AMC_NAME": "Aditya Birla Sun Life Mutual Fund",
"SIF_ENABLE": null
},
{
"AMC_CODE": "H",
"AMC_NAME": "HDFC Mutual Fund",
"SIF_ENABLE": null
},
{
"AMC_CODE": "P",
"AMC_NAME": "ICICI Prudential Mutual Fund",
"SIF_ENABLE": null
},
{
"AMC_CODE": "L",
"AMC_NAME": "SBI Mutual Fund",
"SIF_ENABLE": null
}
],
"detail2": []
}

---

> > > REQUEST #2 (decrypted):
> > > [DECRYPT FAILED] error:1C80006B:Provider routines::wrong final block length

<<< RESPONSE #2 (decrypted):
{
"status": {
"errorflag": false,
"errorcode": "",
"errormsg": "",
"version": "1.0",
"captcha_validation": "",
"captcha_score": "",
"resdatetime": "2/26/2026, 12:00:02 AM 168_36_194"
},
"detail": {
"MESSAGE": "Statement of Financial Transacitons will be sent to your email id abhishek12318@gmail.com having reference number SF205608820.",
"REF_NO": "SF205608820",
"TITLE": "Statement of Financial Transactions (for IT Return filing)",
"QUOTA_EXCEED": "N"
},
"captcha_data": {
"success": true,
"challenge_ts": "2026-02-26T11:29:29Z",
"hostname": "www.camsonline.com",
"score": 0.7,
"action": "GET_ACCOUNT_STATEMENT"
}
}
