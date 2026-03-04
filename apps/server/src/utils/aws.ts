import { PutObjectCommand, S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { CreateTemplateCommand, DeleteTemplateCommand, SendTemplatedEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '@/config';
import fs from 'fs';

const awsConfig = {
    region: config.aws.region,
    credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
    },
};

const sqs = new SQSClient(awsConfig);
const ses = new SESClient(awsConfig);
const s3Client = new S3Client(awsConfig);

export const getS3Client = (): S3Client => {
    return s3Client;
};

export const getPresignedUrl = async (key: string, type: string, bucketName?: string): Promise<string> => {
    const command = new PutObjectCommand({
        Bucket: bucketName || process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        ContentType: type,
    });
    const signedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 3600,
    });
    return signedUrl;
};

export const getPresignedUrlForGet = async (key: string): Promise<string> => {
    const command = new GetObjectCommand({
        Bucket: config.aws.privateBucketName || process.env.AWS_S3_PRIVATE_BUCKET_NAME,
        Key: key,
    });
    const signedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 3600 * 24, // 24 hours
    });
    return signedUrl;
};

export const uploadToS3 = async (
    bucketName: string,
    key: string,
    body: Buffer | string,
    contentType?: string,
    contentLength?: number
): Promise<any> => {
    try {
        const params = {
            Bucket: bucketName,
            Key: key,
            Body: body,
            ContentType: contentType,
            ContentLength: contentLength,
        };
        await s3Client.send(new PutObjectCommand(params));
        logger.info(`Uploaded file s3://${bucketName}/${key}`);
        return encodeURI(`https://${bucketName}.s3.amazonaws.com/${key}`);
    } catch (err) {
        logger.error(`Error uploading file to S3: ${err}`);
        throw err;
    }
};

export const publishToSqs = async (queueUrl: string, message: any, delaySeconds?: number): Promise<void> => {
    try {
        const params: any = {
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(message),
        };

        if (delaySeconds && delaySeconds > 0) {
            params.DelaySeconds = Math.min(delaySeconds, 900);
        }

        await sqs.send(new SendMessageCommand(params));
        logger.info(`Published message to SQS queue ${queueUrl}: ${JSON.stringify(message, null, 4)}`);
    } catch (err) {
        logger.error(`Error publishing message to SQS queue: ${err}`);
        throw err;
    }
};
