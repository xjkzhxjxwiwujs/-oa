package com.campus.reimburse.ocr;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.campus.reimburse.common.BizException;
import com.campus.reimburse.common.LoginUser;
import com.campus.reimburse.common.SecurityUtils;
import com.campus.reimburse.domain.ClaimFile;
import com.campus.reimburse.domain.ClaimForm;
import com.campus.reimburse.domain.InvoiceOcrResult;
import com.campus.reimburse.domain.JobTask;
import com.campus.reimburse.file.StoragePort;
import com.campus.reimburse.mapper.ClaimFileMapper;
import com.campus.reimburse.mapper.ClaimFormMapper;
import com.campus.reimburse.mapper.InvoiceOcrResultMapper;
import com.campus.reimburse.mapper.JobTaskMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OcrService {
    private final OcrProperties properties;
    private final OcrPort ocrPort;
    private final StoragePort storagePort;
    private final ClaimFileMapper fileMapper;
    private final ClaimFormMapper formMapper;
    private final InvoiceOcrResultMapper resultMapper;
    private final JobTaskMapper jobMapper;
    private final ObjectMapper objectMapper;

    public boolean enabled() {
        return properties.isEnabled();
    }

    @Transactional
    public Map<String, Object> queue(Long fileId) {
        if (!properties.isEnabled()) {
            throw new BizException(409, "OCR 未启用");
        }
        LoginUser user = SecurityUtils.requireUser();
        ClaimFile file = requireDraftFile(fileId, user);
        InvoiceOcrResult result = resultMapper.selectOne(new LambdaQueryWrapper<InvoiceOcrResult>()
                .eq(InvoiceOcrResult::getFileId, fileId).last("LIMIT 1"));
        if (result == null) {
            result = new InvoiceOcrResult();
            result.setFileId(fileId);
            result.setProvider(properties.getProvider());
            result.setCreatedAt(LocalDateTime.now());
            resultMapper.insert(result);
        }
        result.setStatus("PENDING");
        result.setMessage(null);
        resultMapper.updateById(result);

        JobTask job = jobMapper.selectOne(new LambdaQueryWrapper<JobTask>()
                .likeRight(JobTask::getDedupKey, "OCR:" + fileId + ":").orderByDesc(JobTask::getId).last("LIMIT 1"));
        if (job == null || "DONE".equals(job.getStatus()) || "FAILED".equals(job.getStatus())) {
            job = new JobTask();
            job.setTaskType("OCR");
            job.setBizType("CLAIM_FILE");
            job.setBizId(fileId);
            job.setDedupKey("OCR:" + fileId + ":" + UUID.randomUUID());
            job.setPayloadJson("{\"fileId\":" + fileId + "}");
            job.setStatus("PENDING");
            job.setAttempts(0);
            job.setMaxAttempts(3);
            job.setNextRunAt(LocalDateTime.now());
            job.setCreatedAt(LocalDateTime.now());
            job.setUpdatedAt(LocalDateTime.now());
            jobMapper.insert(job);
        }
        return Map.of("fileId", fileId, "jobId", job.getId(), "status", "PENDING");
    }

    public InvoiceOcrResult result(Long fileId) {
        ClaimFile file = fileMapper.selectById(fileId);
        if (file == null) throw new BizException(404, "附件不存在");
        assertCanRead(file, SecurityUtils.requireUser());
        return resultMapper.selectOne(new LambdaQueryWrapper<InvoiceOcrResult>()
                .eq(InvoiceOcrResult::getFileId, fileId).last("LIMIT 1"));
    }

    public java.util.List<InvoiceOcrResult> debugResults() {
        if (!SecurityUtils.requireUser().getRoles().contains("ADMIN")) throw new BizException(403, "仅管理员可查看 OCR 调试台");
        return resultMapper.selectList(new LambdaQueryWrapper<InvoiceOcrResult>()
                .orderByDesc(InvoiceOcrResult::getCreatedAt).last("LIMIT 100"));
    }

    @Scheduled(fixedDelayString = "${campus.worker.poll-ms:2000}")
    public void consumeOne() {
        if (!properties.isEnabled() || !properties.isWorkerEnabled()) return;
        JobTask job = jobMapper.selectOne(new LambdaQueryWrapper<JobTask>()
                .eq(JobTask::getTaskType, "OCR").eq(JobTask::getStatus, "PENDING")
                .le(JobTask::getNextRunAt, LocalDateTime.now()).orderByAsc(JobTask::getId).last("LIMIT 1"));
        if (job == null) return;
        if (jobMapper.update(null, new LambdaUpdateWrapper<JobTask>().eq(JobTask::getId, job.getId())
                .eq(JobTask::getStatus, "PENDING").set(JobTask::getStatus, "RUNNING")
                .set(JobTask::getLeaseToken, UUID.randomUUID().toString()).set(JobTask::getLeaseUntil, LocalDateTime.now().plusMinutes(2))) != 1) return;
        execute(job);
    }

    private void execute(JobTask job) {
        try {
            ClaimFile file = fileMapper.selectById(job.getBizId());
            if (file == null) throw new BizException("附件不存在");
            byte[] bytes;
            try (InputStream input = storagePort.get(file.getObjectKey())) {
                bytes = input.readAllBytes();
            }
            OcrResult output = ocrPort.recognize(bytes, file.getMime());
            saveResult(file.getId(), output);
            jobMapper.update(null, new LambdaUpdateWrapper<JobTask>().eq(JobTask::getId, job.getId())
                    .eq(JobTask::getStatus, "RUNNING").set(JobTask::getStatus, "DONE").set(JobTask::getLastError, null));
        } catch (Exception e) {
            int attempts = job.getAttempts() + 1;
            boolean failed = attempts >= job.getMaxAttempts();
            jobMapper.update(null, new LambdaUpdateWrapper<JobTask>().eq(JobTask::getId, job.getId())
                    .eq(JobTask::getStatus, "RUNNING").set(JobTask::getAttempts, attempts)
                    .set(JobTask::getStatus, failed ? "FAILED" : "PENDING")
                    .set(JobTask::getNextRunAt, LocalDateTime.now().plusSeconds(10L * attempts))
                    .set(JobTask::getLastError, e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()));
        }
    }

    private void saveResult(Long fileId, OcrResult output) {
        InvoiceOcrResult result = resultMapper.selectOne(new LambdaQueryWrapper<InvoiceOcrResult>()
                .eq(InvoiceOcrResult::getFileId, fileId).last("LIMIT 1"));
        if (result == null) return;
        result.setStatus(output.status());
        result.setInvoiceCode(output.invoiceCode());
        result.setInvoiceNo(output.invoiceNo());
        result.setIssueDate(parseDate(output.issueDate()));
        result.setAmount(parseAmount(output.amount()));
        result.setBuyerName(output.buyerName());
        result.setMessage(output.message());
        try { result.setRawPayload(objectMapper.writeValueAsString(output.raw())); } catch (Exception ignored) { result.setRawPayload(null); }
        resultMapper.updateById(result);
    }

    private ClaimFile requireDraftFile(Long fileId, LoginUser user) {
        ClaimFile file = fileMapper.selectById(fileId);
        if (file == null || file.getActive() != 1) throw new BizException(404, "附件不存在");
        ClaimForm form = formMapper.selectById(file.getClaimId());
        if (form == null || !"TRAVEL_CLAIM".equals(form.getClaimType()) || !form.getApplicantId().equals(user.getId())
                || !("DRAFT".equals(form.getStatus()) || "RETURNED".equals(form.getStatus()))) {
            throw new BizException(403, "仅可识别本人可编辑报销单中的发票附件");
        }
        if (!file.getMime().startsWith("image/")) throw new BizException("腾讯云 VatInvoiceOCR 仅接受发票图片");
        return file;
    }

    private void assertCanRead(ClaimFile file, LoginUser user) {
        ClaimForm form = formMapper.selectById(file.getClaimId());
        if (form == null || (!form.getApplicantId().equals(user.getId()) && !user.getRoles().contains("FINANCE") && !user.getRoles().contains("ADMIN"))) {
            throw new BizException(403, "无权查看 OCR 结果");
        }
    }

    private static LocalDate parseDate(String value) { try { return value == null ? null : LocalDate.parse(value); } catch (Exception ignored) { return null; } }
    private static BigDecimal parseAmount(String value) { try { return value == null ? null : new BigDecimal(value.replace(",", "")); } catch (Exception ignored) { return null; } }
}
