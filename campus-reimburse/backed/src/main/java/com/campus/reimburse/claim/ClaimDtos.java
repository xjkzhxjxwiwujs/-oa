package com.campus.reimburse.claim;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class ClaimDtos {
    @Data
    public static class PersonIn {
        private Long userId;
        private String guestName;
        private String personType;
        private Integer isApplicant;
    }

    @Data
    public static class LegIn {
        private String fromPlace;
        private String toPlace;
        private String transportCode;
        private LocalDate departDate;
    }

    @Data
    public static class ApplySaveReq {
        private Long id;
        private Long projectId;
        private String reason;
        private LocalDate startDate;
        private LocalDate endDate;
        private String remark;
        private List<PersonIn> persons = new ArrayList<>();
        private List<LegIn> legs = new ArrayList<>();
        private String requestKey;
    }

    @Data
    public static class ExpenseIn {
        private String expenseTypeCode;
        private LocalDate occurredOn;
        private BigDecimal amount;
        private String remark;
    }

    @Data
    public static class InvoiceIn {
        private Long fileId;
        private String invoiceType;
        private String invoiceCode;
        private String invoiceNo;
        private LocalDate issueDate;
        private BigDecimal amount;
        private String buyerName;
    }

    @Data
    public static class ClaimSaveReq {
        private Long id;
        private Long sourceApplyId;
        private String payeeAccount;
        private String payeeBank;
        private List<ExpenseIn> expenses = new ArrayList<>();
        private List<InvoiceIn> invoices = new ArrayList<>();
        private String requestKey;
    }

    @Data
    public static class CoverStepReq {
        private String stepKey;
    }

    @Data
    public static class GuideKeyReq {
        private String featureKey;
        private String stepKey;
    }

    @Data
    public static class ActionReq {
        private Integer version;
        private String comment;
        private String requestKey;
    }

    @Data
    public static class TimelineNode {
        private String nodeCode;
        private String nodeName;
        private String roleCode;
        private String state;
        private String assigneeName;
        private String actedAt;
        private String comment;
        private Long stayHours;
        private Boolean timeout;
    }

    @Data
    public static class PreviewApprover {
        private String nodeCode;
        private String nodeName;
        private String roleCode;
        private Long userId;
        private String realName;
    }
}
