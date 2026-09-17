package com.campus.reimburse.claim;

import com.campus.reimburse.common.ApiResult;
import com.campus.reimburse.common.LoginUser;
import com.campus.reimburse.common.SecurityUtils;
import com.campus.reimburse.domain.SysNotify;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class ClaimController {
    private final ClaimService claimService;
    private final ExportService exportService;
    private final PdfService pdfService;
    private final GuideService guideService;

    @GetMapping("/applicant/approver-preview")
    public ApiResult<List<ClaimDtos.PreviewApprover>> preview(@RequestParam String claimType) {
        LoginUser me = SecurityUtils.requireUser();
        return ApiResult.ok(claimService.preview(claimType, me.getDeptId(), me.getId()));
    }

    @GetMapping("/applicant/claims")
    public ApiResult<List<Map<String, Object>>> myAll() {
        return ApiResult.ok(claimService.myList(null));
    }

    @GetMapping("/applicant/travel-applies")
    public ApiResult<List<Map<String, Object>>> myApplies() {
        return ApiResult.ok(claimService.myList("TRAVEL_APPLY"));
    }

    @PostMapping("/applicant/travel-applies")
    public ApiResult<Map<String, Long>> saveApply(@RequestBody ClaimDtos.ApplySaveReq req) {
        return ApiResult.ok(Map.of("id", claimService.saveApply(req)));
    }

    @GetMapping("/applicant/travel-applies/{id}")
    public ApiResult<Map<String, Object>> applyDetail(@PathVariable Long id) {
        return ApiResult.ok(claimService.detail(id));
    }

    @PostMapping("/applicant/travel-applies/{id}/submit")
    public ApiResult<Void> submitApply(@PathVariable Long id, @RequestBody(required = false) ClaimDtos.ActionReq req) {
        claimService.submitApply(id, req);
        return ApiResult.ok();
    }

    @GetMapping("/applicant/travel-claims")
    public ApiResult<List<Map<String, Object>>> myClaims() {
        return ApiResult.ok(claimService.myList("TRAVEL_CLAIM"));
    }

    @PostMapping("/applicant/travel-claims")
    public ApiResult<Map<String, Long>> saveClaim(@RequestBody ClaimDtos.ClaimSaveReq req) {
        return ApiResult.ok(Map.of("id", claimService.saveClaim(req)));
    }

    @GetMapping("/applicant/travel-claims/{id}")
    public ApiResult<Map<String, Object>> claimDetail(@PathVariable Long id) {
        return ApiResult.ok(claimService.detail(id));
    }

    @PostMapping("/applicant/travel-claims/{id}/submit")
    public ApiResult<Void> submitClaim(@PathVariable Long id, @RequestBody(required = false) ClaimDtos.ActionReq req) {
        claimService.submitClaim(id, req);
        return ApiResult.ok();
    }

    @GetMapping("/applicant/claims/{id}/timeline")
    public ApiResult<List<ClaimDtos.TimelineNode>> timeline(@PathVariable Long id) {
        return ApiResult.ok(claimService.timeline(id));
    }

    @PostMapping("/applicant/files")
    public ApiResult<Map<String, Object>> upload(@RequestParam Long claimId,
                                                 @RequestParam(required = false) String materialCode,
                                                 @RequestParam("file") MultipartFile file) throws Exception {
        return ApiResult.ok(claimService.upload(claimId, file, materialCode));
    }

    @PostMapping("/applicant/pdf/import")
    public ApiResult<Map<String, Object>> importPdf(@RequestParam Long claimId, @RequestParam("file") MultipartFile file) throws Exception {
        return ApiResult.ok(claimService.upload(claimId, file, "CLAIM_PDF"));
    }

    @GetMapping("/applicant/pdf/export")
    public void exportMyPdf(@RequestParam Long id, jakarta.servlet.http.HttpServletResponse response) throws Exception {
        pdfService.write(id, response);
    }

    @GetMapping("/approval/todos")
    public ApiResult<List<Map<String, Object>>> todos() {
        return ApiResult.ok(claimService.todos());
    }

    @GetMapping("/approval/todos/{id}")
    public ApiResult<Map<String, Object>> todoDetail(@PathVariable Long id) {
        return ApiResult.ok(claimService.todoDetail(id));
    }

    @PostMapping("/approval/todos/{id}/pass")
    public ApiResult<Void> pass(@PathVariable Long id, @RequestBody(required = false) ClaimDtos.ActionReq req) {
        claimService.decide(id, "PASS", req);
        return ApiResult.ok();
    }

    @PostMapping("/approval/todos/{id}/return")
    public ApiResult<Void> ret(@PathVariable Long id, @RequestBody ClaimDtos.ActionReq req) {
        claimService.decide(id, "RETURN", req);
        return ApiResult.ok();
    }

    @PostMapping("/approval/todos/{id}/reject")
    public ApiResult<Void> reject(@PathVariable Long id, @RequestBody ClaimDtos.ActionReq req) {
        claimService.decide(id, "REJECT", req);
        return ApiResult.ok();
    }

    @GetMapping("/finance/claims")
    public ApiResult<List<Map<String, Object>>> finance() {
        return ApiResult.ok(claimService.financeList());
    }

    @GetMapping("/finance/claims/{id}")
    public ApiResult<Map<String, Object>> financeDetail(@PathVariable Long id) {
        return ApiResult.ok(claimService.detail(id));
    }

    @PostMapping("/finance/claims/{claimId}/invoices/{invoiceId}/confirm")
    public ApiResult<Void> confirm(@PathVariable Long invoiceId) {
        claimService.confirmInvoice(invoiceId);
        return ApiResult.ok();
    }

    @PostMapping("/finance/export")
    public void financeExport(@RequestParam String format, jakarta.servlet.http.HttpServletResponse response) throws Exception {
        exportService.exportFinance(format, response);
    }

    @GetMapping("/finance/pdf/export")
    public void financePdf(@RequestParam Long id, jakarta.servlet.http.HttpServletResponse response) throws Exception {
        pdfService.write(id, response);
    }

    @PostMapping("/finance/pdf/import")
    public ApiResult<Map<String, Object>> financeImportPdf(@RequestParam Long claimId, @RequestParam("file") MultipartFile file) throws Exception {
        return ApiResult.ok(claimService.upload(claimId, file, "CLAIM_PDF"));
    }

    @GetMapping("/common/notifies")
    public ApiResult<List<SysNotify>> notifies() {
        return ApiResult.ok(claimService.myNotifies());
    }

    @GetMapping("/me/guides")
    public ApiResult<Map<String, Object>> guides() {
        return ApiResult.ok(guideService.list());
    }

    @PostMapping("/me/guides/start")
    public ApiResult<Void> startGuideBody(@RequestBody(required = false) ClaimDtos.GuideKeyReq req) {
        if (req != null && req.getFeatureKey() != null && !req.getFeatureKey().isBlank()) {
            guideService.start(req.getFeatureKey().trim());
        }
        return ApiResult.ok();
    }

    @PostMapping("/me/guides/skip")
    public ApiResult<Void> skipGuideBody(@RequestBody(required = false) ClaimDtos.GuideKeyReq req) {
        if (req != null && req.getFeatureKey() != null && !req.getFeatureKey().isBlank()) {
            guideService.skip(req.getFeatureKey().trim());
        }
        return ApiResult.ok();
    }

    @PostMapping("/me/guides/complete")
    public ApiResult<Void> completeGuideBody(@RequestBody(required = false) ClaimDtos.GuideKeyReq req) {
        if (req != null && req.getFeatureKey() != null && !req.getFeatureKey().isBlank()) {
            guideService.complete(req.getFeatureKey().trim());
        }
        return ApiResult.ok();
    }

    @PostMapping("/me/guides/{featureKey:.+}/start")
    public ApiResult<Void> startGuide(@PathVariable String featureKey) {
        guideService.start(featureKey);
        return ApiResult.ok();
    }

    @PostMapping("/me/guides/{featureKey:.+}/skip")
    public ApiResult<Void> skipGuide(@PathVariable String featureKey) {
        guideService.skip(featureKey);
        return ApiResult.ok();
    }

    @PostMapping("/me/guides/{featureKey:.+}/complete")
    public ApiResult<Void> completeGuide(@PathVariable String featureKey) {
        guideService.complete(featureKey);
        return ApiResult.ok();
    }

    @PostMapping("/me/guides/onboarding/cover")
    public ApiResult<Void> coverGuideStep(@RequestBody(required = false) ClaimDtos.CoverStepReq req) {
        if (req != null && req.getStepKey() != null && !req.getStepKey().isBlank()) {
            guideService.coverStep(req.getStepKey().trim());
        }
        return ApiResult.ok();
    }

    @PostMapping("/me/guides/onboarding/steps/{stepKey:.+}")
    public ApiResult<Void> coverGuideStepPath(@PathVariable String stepKey) {
        if (stepKey != null && !stepKey.isBlank()) {
            guideService.coverStep(stepKey.trim());
        }
        return ApiResult.ok();
    }

    @PostMapping("/common/debug-seed")
    public ApiResult<Map<String, Object>> debugSeed() {
        return ApiResult.ok(claimService.seedDebug());
    }
}
