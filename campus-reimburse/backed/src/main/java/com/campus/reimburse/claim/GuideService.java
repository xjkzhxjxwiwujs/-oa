package com.campus.reimburse.claim;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.campus.reimburse.common.LoginUser;
import com.campus.reimburse.common.SecurityUtils;
import com.campus.reimburse.domain.UserGuideProgress;
import com.campus.reimburse.domain.UserGuideStep;
import com.campus.reimburse.mapper.UserGuideProgressMapper;
import com.campus.reimburse.mapper.UserGuideStepMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GuideService {
    public static final String ONBOARDING = "onboarding";
    public static final List<String> FEATURES = List.of(
            ONBOARDING,
            "page.apply.home", "page.apply.form", "page.apply.claim", "page.apply.docs",
            "page.approve.home", "page.approve.todo", "page.approve.finance", "page.approve.financeDetail",
            "travel.apply.create", "travel.claim.create", "claim.timeline",
            "claim.return_resubmit", "approval.dept", "approval.college",
            "approval.finance", "data.export.finance", "pdf.import.claim");

    private final UserGuideProgressMapper progressMapper;
    private final UserGuideStepMapper stepMapper;

    public Map<String, Object> list() {
        LoginUser me = SecurityUtils.requireUser();
        List<UserGuideProgress> rows = progressMapper.selectList(
                new LambdaQueryWrapper<UserGuideProgress>().eq(UserGuideProgress::getUserId, me.getId()));
        UserGuideProgress onboarding = rows.stream()
                .filter(p -> ONBOARDING.equals(p.getFeatureKey()) && Integer.valueOf(1).equals(p.getGuideVersion()))
                .findFirst().orElse(null);
        List<String> covered = List.of();
        if (onboarding != null) {
            covered = stepMapper.selectList(new LambdaQueryWrapper<UserGuideStep>()
                            .eq(UserGuideStep::getProgressId, onboarding.getId()))
                    .stream().map(UserGuideStep::getStepKey).toList();
        }
        Map<String, Object> ob = new LinkedHashMap<>();
        ob.put("status", onboarding == null ? "NONE" : onboarding.getStatus());
        ob.put("currentStepKey", onboarding == null ? null : onboarding.getCurrentStepKey());
        ob.put("covered", covered);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("features", FEATURES);
        m.put("progress", rows);
        m.put("onboarding", ob);
        return m;
    }

    public void start(String featureKey) {
        upsert(featureKey, "IN_PROGRESS", false);
    }

    public void skip(String featureKey) {
        upsert(featureKey, "SKIPPED", false);
    }

    public void complete(String featureKey) {
        upsert(featureKey, "COMPLETED", true);
    }

    public void coverStep(String stepKey) {
        if (stepKey == null || stepKey.isBlank()) {
            return;
        }
        String key = stepKey.trim();
        if (key.length() > 64) {
            key = key.substring(0, 64);
        }
        UserGuideProgress p = upsert(ONBOARDING, "IN_PROGRESS", false);
        p.setCurrentStepKey(key);
        progressMapper.updateById(p);
        Long exists = stepMapper.selectCount(new LambdaQueryWrapper<UserGuideStep>()
                .eq(UserGuideStep::getProgressId, p.getId())
                .eq(UserGuideStep::getStepKey, key));
        if (exists != null && exists > 0) {
            return;
        }
        UserGuideStep s = new UserGuideStep();
        s.setProgressId(p.getId());
        s.setStepKey(key);
        s.setCoveredAt(LocalDateTime.now());
        try {
            stepMapper.insert(s);
        } catch (DuplicateKeyException ignored) {
            // 同一步并发点击，视为已覆盖
        }
    }

    private UserGuideProgress upsert(String feature, String status, boolean done) {
        LoginUser me = SecurityUtils.requireUser();
        UserGuideProgress existing = find(me.getId(), feature);
        if (existing == null) {
            UserGuideProgress p = new UserGuideProgress();
            p.setUserId(me.getId());
            p.setFeatureKey(feature);
            p.setGuideVersion(1);
            p.setRunId(UUID.randomUUID().toString());
            p.setRowVersion(0);
            p.setFirstStartedAt(LocalDateTime.now());
            p.setStatus(status);
            if (done) {
                p.setCompletedAt(LocalDateTime.now());
            }
            if ("SKIPPED".equals(status)) {
                p.setSkippedAt(LocalDateTime.now());
            }
            try {
                progressMapper.insert(p);
                return p;
            } catch (DuplicateKeyException e) {
                existing = find(me.getId(), feature);
                if (existing == null) {
                    throw e;
                }
            }
        }
        UserGuideProgress p = existing;
        if ("COMPLETED".equals(p.getStatus()) && ("IN_PROGRESS".equals(status) || "SKIPPED".equals(status))) {
            return p;
        }
        p.setStatus(status);
        p.setRowVersion(p.getRowVersion() == null ? 1 : p.getRowVersion() + 1);
        if (done) {
            p.setCompletedAt(LocalDateTime.now());
        }
        if ("SKIPPED".equals(status)) {
            p.setSkippedAt(LocalDateTime.now());
        }
        progressMapper.updateById(p);
        return p;
    }

    private UserGuideProgress find(Long userId, String feature) {
        return progressMapper.selectOne(new LambdaQueryWrapper<UserGuideProgress>()
                .eq(UserGuideProgress::getUserId, userId)
                .eq(UserGuideProgress::getFeatureKey, feature)
                .eq(UserGuideProgress::getGuideVersion, 1)
                .last("LIMIT 1"));
    }
}
