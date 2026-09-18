package com.campus.reimburse;

import com.campus.reimburse.ocr.OcrProperties;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(OcrProperties.class)
@MapperScan("com.campus.reimburse.mapper")
public class CampusReimburseApplication {
    public static void main(String[] args) {
        SpringApplication.run(CampusReimburseApplication.class, args);
    }
}
