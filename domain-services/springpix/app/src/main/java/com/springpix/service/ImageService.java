package com.springpix.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.model.*;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.UUID;

@Service
public class ImageService {

    private final String bucketName;
    private final String awsAccessKeyId;
    private final String awsSecretAccessKey;
    private final String region;
    private final String endpoint;

    // built lazily on first upload, not here — building it eagerly means the
    // whole app can't even start up without real credentials configured
    private volatile S3Client s3Client;
    private volatile boolean bucketEnsured;

    // @Value fields aren't populated until after Spring calls the
    // constructor — inject via constructor parameters instead.
    public ImageService(
            @Value("${aws.s3.bucket-name}") String bucketName,
            @Value("${aws.access-key-id}") String awsAccessKeyId,
            @Value("${aws.secret-access-key}") String awsSecretAccessKey,
            @Value("${aws.region}") String awsRegion,
            @Value("${aws.s3.endpoint}") String endpoint) {
        this.bucketName = bucketName;
        this.awsAccessKeyId = awsAccessKeyId;
        this.awsSecretAccessKey = awsSecretAccessKey;
        this.region = awsRegion;
        this.endpoint = endpoint;
    }

    private S3Client s3Client() {
        S3Client client = s3Client;
        if (client == null) {
            synchronized (this) {
                client = s3Client;
                if (client == null) {
                    AwsBasicCredentials awsCreds = AwsBasicCredentials.create(awsAccessKeyId, awsSecretAccessKey);
                    S3ClientBuilder builder = S3Client.builder()
                            .region(Region.of(region))
                            .credentialsProvider(StaticCredentialsProvider.create(awsCreds));

                    if (endpoint != null && !endpoint.isBlank()) {
                        // MinIO (and most S3-compatible stores) need path-style
                        // access — bucket.example.com doesn't resolve for them
                        builder.endpointOverride(URI.create(endpoint)).forcePathStyle(true);
                    }

                    client = builder.build();
                    s3Client = client;
                }
            }
        }
        return client;
    }

    private void ensureBucketExists(S3Client client) {
        if (bucketEnsured) {
            return;
        }
        synchronized (this) {
            if (bucketEnsured) {
                return;
            }
            try {
                client.headBucket(HeadBucketRequest.builder().bucket(bucketName).build());
            } catch (NoSuchBucketException e) {
                client.createBucket(CreateBucketRequest.builder().bucket(bucketName).build());
            }
            bucketEnsured = true;
        }
    }

    // Upload image to S3
    public String uploadImage(MultipartFile file) throws IOException {
        String keyName = UUID.randomUUID().toString() + "_" + file.getOriginalFilename();

        S3Client client = s3Client();
        ensureBucketExists(client);

        // Create PutObjectRequest
        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(keyName)
                .build();

        try (InputStream inputStream = file.getInputStream()) {
            client.putObject(putObjectRequest, RequestBody.fromInputStream(inputStream, file.getSize()));
        }

        return generateS3Url(keyName);
    }

    // Generate public URL for the uploaded image
    private String generateS3Url(String keyName) {
        if (endpoint != null && !endpoint.isBlank()) {
            return endpoint + "/" + bucketName + "/" + keyName;
        }
        return "https://" + bucketName + ".s3." + region + ".amazonaws.com/" + keyName;
    }

    // Get the image status (could be a placeholder or the actual state)
    public String getImageStatus(String imageId) {
        return "Image " + imageId + " processed and available at S3 URL";
    }
}
