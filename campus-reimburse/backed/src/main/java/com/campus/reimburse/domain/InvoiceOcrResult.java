package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("invoice_ocr_result")
public class InvoiceOcrResult {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long fileId;
    private String provider;
    private String status;
    private String invoiceCode;
    private String invoiceNo;
    private LocalDate issueDate;
    private BigDecimal amount;
    private String buyerName;
    private String rawPayload;
    private String message;
    private LocalDateTime createdAt;
}
