package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("travel_person")
public class TravelPerson {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long claimId;
    private Integer sortNo;
    private Long userId;
    private String guestName;
    private String personType;
    private Integer isApplicant;
}
