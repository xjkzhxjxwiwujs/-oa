package com.campus.reimburse.ocr;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "campus.ocr")
public class OcrProperties {
    private boolean enabled;
    private String provider = "mock";
    private boolean failOpen = true;
    private int timeoutMs = 8000;
    private boolean workerEnabled = false;
    private Tencent tencent = new Tencent();

    @Data
    public static class Tencent {
        private String secretId;
        private String secretKey;
        private String region = "ap-guangzhou";
        private String endpoint = "ocr.tencentcloudapi.com";
    }
}
