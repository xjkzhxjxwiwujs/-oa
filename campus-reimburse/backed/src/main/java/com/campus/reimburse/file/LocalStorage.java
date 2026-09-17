package com.campus.reimburse.file;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Component
@ConditionalOnProperty(name = "campus.storage.type", havingValue = "local")
public class LocalStorage implements StoragePort {
    private final Path root;

    public LocalStorage(@Value("${campus.storage.local-dir:./data/files}") String dir) {
        this.root = Path.of(dir).toAbsolutePath();
        try {
            Files.createDirectories(this.root);
        } catch (IOException e) {
            throw new IllegalStateException("local storage", e);
        }
    }

    @Override
    public void put(String objectKey, InputStream in, long size, String contentType) {
        try {
            Path dest = root.resolve(objectKey).normalize();
            if (!dest.startsWith(root)) {
                throw new IllegalArgumentException("bad key");
            }
            Files.createDirectories(dest.getParent());
            Files.copy(in, dest, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new IllegalStateException("local put", e);
        }
    }

    @Override
    public InputStream get(String objectKey) {
        try {
            return Files.newInputStream(root.resolve(objectKey));
        } catch (IOException e) {
            throw new IllegalStateException("local get", e);
        }
    }

    @Override
    public void delete(String objectKey) {
        try {
            Files.deleteIfExists(root.resolve(objectKey));
        } catch (IOException e) {
            throw new IllegalStateException("local delete", e);
        }
    }
}
