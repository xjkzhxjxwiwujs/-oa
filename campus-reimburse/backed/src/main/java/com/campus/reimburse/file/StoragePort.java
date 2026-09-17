package com.campus.reimburse.file;

import java.io.InputStream;

public interface StoragePort {
    void put(String objectKey, InputStream in, long size, String contentType);
    InputStream get(String objectKey);
    void delete(String objectKey);
}
