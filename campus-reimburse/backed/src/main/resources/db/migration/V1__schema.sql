SET NAMES utf8mb4;

CREATE TABLE sys_dept (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    parent_id BIGINT NULL,
    name VARCHAR(64) NOT NULL,
    code VARCHAR(32) NOT NULL,
    deleted TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_dept_code (code),
    CONSTRAINT fk_dept_parent FOREIGN KEY (parent_id) REFERENCES sys_dept (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE sys_user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    dept_id BIGINT NOT NULL,
    username VARCHAR(64) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    real_name VARCHAR(64) NOT NULL,
    phone_enc VARCHAR(512) NULL,
    enc_key_version INT NOT NULL DEFAULT 1,
    status TINYINT NOT NULL DEFAULT 1,
    permission_version INT NOT NULL DEFAULT 1,
    deleted TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_user_username (username),
    CONSTRAINT fk_user_dept FOREIGN KEY (dept_id) REFERENCES sys_dept (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE sys_role (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(32) NOT NULL,
    name VARCHAR(64) NOT NULL,
    UNIQUE KEY uk_role_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE sys_user_role (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES sys_user (id),
    CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES sys_role (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE sys_user_dept_scope (
    user_id BIGINT NOT NULL,
    dept_id BIGINT NOT NULL,
    include_children TINYINT NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, dept_id),
    CONSTRAINT fk_uds_user FOREIGN KEY (user_id) REFERENCES sys_user (id),
    CONSTRAINT fk_uds_dept FOREIGN KEY (dept_id) REFERENCES sys_dept (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE sys_dict (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    dict_type VARCHAR(32) NOT NULL,
    dict_code VARCHAR(32) NOT NULL,
    dict_label VARCHAR(64) NOT NULL,
    sort_no INT NOT NULL DEFAULT 0,
    UNIQUE KEY uk_dict (dict_type, dict_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE fund_project (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    enabled TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_project_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE wf_template (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    claim_type VARCHAR(32) NOT NULL,
    version INT NOT NULL,
    name VARCHAR(64) NOT NULL,
    enabled TINYINT NOT NULL DEFAULT 1,
    UNIQUE KEY uk_wf_tpl (claim_type, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE wf_node (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    template_id BIGINT NOT NULL,
    node_code VARCHAR(32) NOT NULL,
    node_name VARCHAR(64) NOT NULL,
    sort_no INT NOT NULL,
    role_code VARCHAR(32) NOT NULL,
    timeout_hours INT NOT NULL DEFAULT 24,
    UNIQUE KEY uk_wf_node (template_id, node_code),
    CONSTRAINT fk_wf_node_tpl FOREIGN KEY (template_id) REFERENCES wf_template (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE claim_form (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    claim_no VARCHAR(32) NOT NULL,
    claim_type VARCHAR(32) NOT NULL,
    applicant_id BIGINT NOT NULL,
    dept_id BIGINT NOT NULL,
    wf_template_id BIGINT NOT NULL,
    status VARCHAR(24) NOT NULL,
    current_node VARCHAR(32) NULL,
    version INT NOT NULL DEFAULT 0,
    workflow_round INT NOT NULL DEFAULT 1,
    amount DECIMAL(12,2) NULL,
    invoice_check_status VARCHAR(16) NULL,
    material_rule_version INT NULL,
    source_apply_id BIGINT NULL,
    submitted_at DATETIME(3) NULL,
    finished_at DATETIME(3) NULL,
    deleted TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    source_apply_active BIGINT GENERATED ALWAYS AS (
        CASE WHEN deleted = 0 AND status NOT IN ('CANCELLED','REJECTED') THEN source_apply_id ELSE NULL END
    ) STORED,
    UNIQUE KEY uk_claim_no (claim_no),
    UNIQUE KEY uk_source_apply_active (source_apply_active),
    KEY idx_claim_applicant (applicant_id, deleted, created_at, id),
    KEY idx_claim_dept (dept_id, deleted, status, created_at, id),
    KEY idx_claim_source (source_apply_id),
    CONSTRAINT fk_claim_applicant FOREIGN KEY (applicant_id) REFERENCES sys_user (id),
    CONSTRAINT fk_claim_dept FOREIGN KEY (dept_id) REFERENCES sys_dept (id),
    CONSTRAINT fk_claim_tpl FOREIGN KEY (wf_template_id) REFERENCES wf_template (id),
    CONSTRAINT fk_claim_source FOREIGN KEY (source_apply_id) REFERENCES claim_form (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE travel_apply (
    claim_id BIGINT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    reason VARCHAR(200) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    remark VARCHAR(500) NULL,
    CONSTRAINT fk_ta_claim FOREIGN KEY (claim_id) REFERENCES claim_form (id),
    CONSTRAINT fk_ta_project FOREIGN KEY (project_id) REFERENCES fund_project (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE travel_person (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    claim_id BIGINT NOT NULL,
    sort_no INT NOT NULL,
    user_id BIGINT NULL,
    guest_name VARCHAR(64) NULL,
    person_type VARCHAR(32) NOT NULL,
    is_applicant TINYINT NOT NULL DEFAULT 0,
    UNIQUE KEY uk_tp_sort (claim_id, sort_no),
    CONSTRAINT fk_tp_apply FOREIGN KEY (claim_id) REFERENCES travel_apply (claim_id),
    CONSTRAINT fk_tp_user FOREIGN KEY (user_id) REFERENCES sys_user (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE travel_leg (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    claim_id BIGINT NOT NULL,
    sort_no INT NOT NULL,
    from_place VARCHAR(64) NOT NULL,
    to_place VARCHAR(64) NOT NULL,
    transport_code VARCHAR(32) NOT NULL,
    depart_date DATE NOT NULL,
    UNIQUE KEY uk_tl_sort (claim_id, sort_no),
    CONSTRAINT fk_tl_apply FOREIGN KEY (claim_id) REFERENCES travel_apply (claim_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE travel_claim (
    claim_id BIGINT PRIMARY KEY,
    payee_account_enc VARCHAR(512) NULL,
    payee_bank VARCHAR(64) NULL,
    enc_key_version INT NOT NULL DEFAULT 1,
    CONSTRAINT fk_tc_claim FOREIGN KEY (claim_id) REFERENCES claim_form (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE claim_expense_line (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    claim_id BIGINT NOT NULL,
    line_no INT NOT NULL,
    expense_type_code VARCHAR(32) NOT NULL,
    occurred_on DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    remark VARCHAR(255) NULL,
    UNIQUE KEY uk_exp_line (claim_id, line_no),
    CONSTRAINT fk_exp_claim FOREIGN KEY (claim_id) REFERENCES claim_form (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE claim_file (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    claim_id BIGINT NOT NULL,
    object_key VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime VARCHAR(128) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 CHAR(64) NOT NULL,
    uploader_id BIGINT NOT NULL,
    active TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_file_key (object_key),
    KEY idx_file_claim (claim_id, active, id),
    CONSTRAINT fk_file_claim FOREIGN KEY (claim_id) REFERENCES claim_form (id),
    CONSTRAINT fk_file_user FOREIGN KEY (uploader_id) REFERENCES sys_user (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE claim_file_material (
    file_id BIGINT NOT NULL,
    material_code VARCHAR(32) NOT NULL,
    PRIMARY KEY (file_id, material_code),
    CONSTRAINT fk_cfm_file FOREIGN KEY (file_id) REFERENCES claim_file (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE claim_expense_file (
    expense_line_id BIGINT NOT NULL,
    file_id BIGINT NOT NULL,
    PRIMARY KEY (expense_line_id, file_id),
    CONSTRAINT fk_cef_line FOREIGN KEY (expense_line_id) REFERENCES claim_expense_line (id),
    CONSTRAINT fk_cef_file FOREIGN KEY (file_id) REFERENCES claim_file (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE invoice_ocr_result (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    file_id BIGINT NOT NULL,
    provider VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    invoice_code VARCHAR(32) NULL,
    invoice_no VARCHAR(32) NULL,
    issue_date DATE NULL,
    amount DECIMAL(12,2) NULL,
    buyer_name VARCHAR(128) NULL,
    raw_payload JSON NULL,
    message VARCHAR(255) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_ocr_file (file_id),
    CONSTRAINT fk_ocr_file FOREIGN KEY (file_id) REFERENCES claim_file (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE claim_invoice (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    claim_id BIGINT NOT NULL,
    file_id BIGINT NOT NULL,
    invoice_type VARCHAR(32) NOT NULL,
    invoice_code VARCHAR(32) NULL,
    invoice_no VARCHAR(32) NOT NULL,
    invoice_key VARCHAR(128) NULL,
    issue_date DATE NULL,
    amount DECIMAL(12,2) NULL,
    buyer_name VARCHAR(128) NULL,
    confirm_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    confirmed_by BIGINT NULL,
    confirmed_at DATETIME(3) NULL,
    version INT NOT NULL DEFAULT 0,
    verify_status VARCHAR(16) NOT NULL DEFAULT 'SKIPPED',
    verified_at DATETIME(3) NULL,
    UNIQUE KEY uk_inv_key (claim_id, invoice_key),
    CONSTRAINT fk_inv_claim FOREIGN KEY (claim_id) REFERENCES claim_form (id),
    CONSTRAINT fk_inv_file FOREIGN KEY (file_id) REFERENCES claim_file (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE invoice_occupation (
    invoice_key VARCHAR(128) NOT NULL,
    claim_id BIGINT NOT NULL,
    claim_invoice_id BIGINT NOT NULL,
    occupied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (invoice_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE claim_todo (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    claim_id BIGINT NOT NULL,
    workflow_round INT NOT NULL,
    node_code VARCHAR(32) NOT NULL,
    assignee_id BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL,
    due_at DATETIME(3) NULL,
    reminded_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_todo_round_node (claim_id, workflow_round, node_code),
    KEY idx_todo_assignee (assignee_id, status, created_at, id),
    KEY idx_todo_due (status, due_at, id),
    CONSTRAINT fk_todo_claim FOREIGN KEY (claim_id) REFERENCES claim_form (id),
    CONSTRAINT fk_todo_user FOREIGN KEY (assignee_id) REFERENCES sys_user (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE claim_flow_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    claim_id BIGINT NOT NULL,
    workflow_round INT NOT NULL,
    node_code VARCHAR(32) NULL,
    action VARCHAR(32) NOT NULL,
    operator_id BIGINT NOT NULL,
    comment VARCHAR(500) NULL,
    request_id VARCHAR(64) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_flow_claim (claim_id, created_at, id),
    CONSTRAINT fk_flow_claim FOREIGN KEY (claim_id) REFERENCES claim_form (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE sys_notify (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    title VARCHAR(128) NOT NULL,
    content VARCHAR(500) NOT NULL,
    biz_type VARCHAR(32) NOT NULL,
    biz_id BIGINT NOT NULL,
    event_key VARCHAR(128) NOT NULL,
    read_flag TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_notify_event (user_id, event_key),
    KEY idx_notify_user (user_id, read_flag, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE sys_audit_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    actor_id BIGINT NULL,
    action VARCHAR(32) NOT NULL,
    target_type VARCHAR(32) NULL,
    target_id BIGINT NULL,
    request_id VARCHAR(64) NULL,
    ip VARCHAR(64) NULL,
    success TINYINT NOT NULL,
    detail VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_audit_time (created_at, id),
    KEY idx_audit_actor (actor_id, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE api_idempotency (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    actor_id BIGINT NOT NULL,
    action VARCHAR(32) NOT NULL,
    request_key VARCHAR(64) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    biz_id BIGINT NULL,
    result_json JSON NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expires_at DATETIME(3) NOT NULL,
    UNIQUE KEY uk_idem (actor_id, action, request_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE claim_revision (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    claim_id BIGINT NOT NULL,
    revision_no INT NOT NULL,
    action VARCHAR(32) NOT NULL,
    actor_id BIGINT NOT NULL,
    snapshot_json JSON NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_rev (claim_id, revision_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE claim_material_rule (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    claim_type VARCHAR(32) NOT NULL,
    rule_version INT NOT NULL,
    material_code VARCHAR(32) NOT NULL,
    material_name VARCHAR(64) NOT NULL,
    requirement_level VARCHAR(16) NOT NULL,
    condition_json JSON NULL,
    enabled TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE job_task (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_type VARCHAR(32) NOT NULL,
    biz_type VARCHAR(32) NULL,
    biz_id BIGINT NULL,
    dedup_key VARCHAR(128) NOT NULL,
    payload_json JSON NULL,
    status VARCHAR(16) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    next_run_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    lease_owner VARCHAR(64) NULL,
    lease_token VARCHAR(64) NULL,
    lease_until DATETIME(3) NULL,
    last_error VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_job_dedup (dedup_key),
    KEY idx_job_poll (task_type, status, next_run_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE data_export (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    requester_id BIGINT NOT NULL,
    format VARCHAR(16) NOT NULL,
    scope_type VARCHAR(16) NOT NULL,
    filter_json JSON NULL,
    columns_json JSON NULL,
    permission_version INT NOT NULL DEFAULT 1,
    cutoff_at DATETIME(3) NOT NULL,
    file_object_key VARCHAR(255) NULL,
    row_count INT NULL,
    expires_at DATETIME(3) NULL,
    job_id BIGINT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    finished_at DATETIME(3) NULL,
    KEY idx_export_user (requester_id, created_at),
    CONSTRAINT fk_export_job FOREIGN KEY (job_id) REFERENCES job_task (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE data_import (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    requester_id BIGINT NOT NULL,
    biz_type VARCHAR(32) NOT NULL,
    source_object_key VARCHAR(255) NOT NULL,
    source_hash CHAR(64) NOT NULL,
    template_version VARCHAR(32) NULL,
    mapping_json JSON NULL,
    job_id BIGINT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE data_import_item (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    import_id BIGINT NOT NULL,
    object_key VARCHAR(64) NOT NULL,
    sheet_name VARCHAR(64) NULL,
    status VARCHAR(16) NOT NULL,
    result_biz_id BIGINT NULL,
    error_code VARCHAR(64) NULL,
    UNIQUE KEY uk_import_item (import_id, object_key),
    CONSTRAINT fk_import_item FOREIGN KEY (import_id) REFERENCES data_import (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_guide_progress (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    feature_key VARCHAR(64) NOT NULL,
    guide_version INT NOT NULL DEFAULT 1,
    status VARCHAR(16) NOT NULL,
    current_step_key VARCHAR(64) NULL,
    run_id VARCHAR(64) NULL,
    row_version INT NOT NULL DEFAULT 0,
    first_started_at DATETIME(3) NULL,
    completed_at DATETIME(3) NULL,
    skipped_at DATETIME(3) NULL,
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_guide (user_id, feature_key, guide_version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_guide_step (
    progress_id BIGINT NOT NULL,
    step_key VARCHAR(64) NOT NULL,
    covered_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (progress_id, step_key),
    CONSTRAINT fk_guide_step FOREIGN KEY (progress_id) REFERENCES user_guide_progress (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_feature_usage (
    user_id BIGINT NOT NULL,
    feature_key VARCHAR(64) NOT NULL,
    first_success_at DATETIME(3) NOT NULL,
    last_success_at DATETIME(3) NOT NULL,
    PRIMARY KEY (user_id, feature_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
