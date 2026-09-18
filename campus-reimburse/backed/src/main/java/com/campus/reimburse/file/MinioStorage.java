package com.campus.reimburse.file;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.GetObjectArgs;
import io.minio.RemoveObjectArgs;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.InputStream;

@Component
@ConditionalOnProperty(name = "campus.storage.type", havingValue = "minio", matchIfMissing = true)
public class MinioStorage implements StoragePort {
    private final MinioClient client;
    private final String bucket;

    public MinioStorage(
            @Value("${campus.storage.endpoint}") String endpoint,
            @Value("${campus.storage.access-key}") String access,
            @Value("${campus.storage.secret-key}") String secret,
            @Value("${campus.storage.bucket}") String bucket) {
        this.client = MinioClient.builder().endpoint(endpoint).credentials(access, secret).build();
        this.bucket = bucket;
    }

    @PostConstruct
    public void ensureBucket() {
        Exception last = null;
        for (int i = 0; i < 20; i++) {
            try {
                if (!client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
                    client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                }
                return;
            } catch (Exception e) {
                last = e;
                try {
                    Thread.sleep(2000);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("minio bucket", e);
                }
            }
        }
        throw new IllegalStateException("minio bucket", last);
    }

    @Override
    public void put(String objectKey, InputStream in, long size, String contentType) {
        try {
            client.putObject(PutObjectArgs.builder().bucket(bucket).object(objectKey)
                    .stream(in, size, -1).contentType(contentType).build());
        } catch (Exception e) {
            throw new IllegalStateException("minio put", e);
        }
    }

    @Override
    public InputStream get(String objectKey) {
        try {
            return client.getObject(GetObjectArgs.builder().bucket(bucket).object(objectKey).build());
        } catch (Exception e) {
            throw new IllegalStateException("minio get", e);
        }
    }

    @Override
    public void delete(String objectKey) {
        try {
            client.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(objectKey).build());
        } catch (Exception e) {
            throw new IllegalStateException("minio delete", e);
        }
    }
}
