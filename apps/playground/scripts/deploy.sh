STAGE=beta
BUCKET=$2

 echo "-- Deploying to staging --"
BUCKET=admin.flexxmoney.in
DISTRIBUTION_ID=E2GDULAQNXOA50


echo "-- Build --"
npm run build:$STAGE
echo "-- Deploy --"
aws s3 sync dist s3://$BUCKET 
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"