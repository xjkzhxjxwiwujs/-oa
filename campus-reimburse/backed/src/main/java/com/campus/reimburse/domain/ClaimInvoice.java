package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("claim_invoice")
public class ClaimInvoice {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long claimId;
    private Long fileId;
    private String invoiceType;
    private String invoiceCode;
    private String invoiceNo;
    private String invoiceKey;
    private LocalDate issueDate;
    private BigDecimal amount;
    private String buyerName;
    private String confirmStatus;
    private Long confirmedBy;
    private LocalDateTime confirmedAt;
    private Integer version;
    private String verifyStatus;
    private LocalDateTime verifiedAt;
}
