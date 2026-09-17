package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("invoice_occupation")
public class InvoiceOccupation {
    @TableId(type = IdType.INPUT)
    private String invoiceKey;
    private Long claimId;
    private Long claimInvoiceId;
    private LocalDateTime occupiedAt;
}
