package com.campus.reimburse;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@MapperScan("com.campus.reimburse.mapper")
public class CampusReimburseApplication {
    public static void main(String[] args) {
        SpringApplication.run(CampusReimburseApplication.class, args);
    }
}
