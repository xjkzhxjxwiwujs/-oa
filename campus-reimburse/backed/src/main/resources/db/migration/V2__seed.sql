INSERT INTO sys_dept (id, parent_id, name, code) VALUES (1, NULL, '电子信息学院', 'DX');

INSERT INTO sys_role (id, code, name) VALUES
 (1, 'APPLICANT', '申请人'),
 (2, 'APPROVER', '部门领导'),
 (3, 'COLLEGE', '学院审批'),
 (4, 'FINANCE', '财务'),
 (5, 'ADMIN', '管理员');

INSERT INTO sys_user (id, dept_id, username, password_hash, real_name, status) VALUES
 (1, 1, 'zhang', '$2b$10$6ylNcm.mku9cDeqJajn4yuuiT9t0RrvVNn4SKumyuIBCOj77Q6LkW', '张同学', 1),
 (2, 1, 'wang', '$2b$10$6ylNcm.mku9cDeqJajn4yuuiT9t0RrvVNn4SKumyuIBCOj77Q6LkW', '王老师', 1),
 (3, 1, 'li', '$2b$10$6ylNcm.mku9cDeqJajn4yuuiT9t0RrvVNn4SKumyuIBCOj77Q6LkW', '李主任', 1),
 (4, 1, 'zhou', '$2b$10$6ylNcm.mku9cDeqJajn4yuuiT9t0RrvVNn4SKumyuIBCOj77Q6LkW', '周院长', 1),
 (5, 1, 'chen', '$2b$10$6ylNcm.mku9cDeqJajn4yuuiT9t0RrvVNn4SKumyuIBCOj77Q6LkW', '陈会计', 1),
 (6, 1, 'admin', '$2b$10$6ylNcm.mku9cDeqJajn4yuuiT9t0RrvVNn4SKumyuIBCOj77Q6LkW', '系统管理员', 1);

INSERT INTO sys_user_role (user_id, role_id) VALUES
 (1, 1), (2, 1), (3, 2), (4, 3), (5, 4), (6, 5);

INSERT INTO sys_user_dept_scope (user_id, dept_id, include_children) VALUES (5, 1, 1);

INSERT INTO fund_project (id, code, name, enabled) VALUES
 (1, 'KY-2026-042', '智能传感器研究', 1),
 (2, 'KY-2025-118', '物联网教学改革', 1);

INSERT INTO sys_dict (dict_type, dict_code, dict_label, sort_no) VALUES
 ('TRANSPORT', 'TRAIN', '火车', 1),
 ('TRANSPORT', 'HSR', '高铁', 2),
 ('TRANSPORT', 'AIR', '飞机', 3),
 ('TRANSPORT', 'BUS', '汽车', 4),
 ('TRANSPORT', 'SHIP', '轮船', 5),
 ('TRANSPORT', 'OTHER', '其他', 6),
 ('EXPENSE_TYPE', 'TRAFFIC', '交通', 1),
 ('EXPENSE_TYPE', 'HOTEL', '住宿', 2),
 ('EXPENSE_TYPE', 'LOCAL', '市内交通', 3),
 ('EXPENSE_TYPE', 'MEAL', '伙食补助', 4),
 ('EXPENSE_TYPE', 'OTHER', '其他', 5),
 ('PERSON_TYPE', 'STAFF', '教职工', 1),
 ('PERSON_TYPE', 'STUDENT', '学生', 2),
 ('PERSON_TYPE', 'GUEST', '编外', 3),
 ('FILE_MATERIAL', 'INVOICE', '发票', 1),
 ('FILE_MATERIAL', 'CLAIM_PDF', '报销单原件', 2);

INSERT INTO wf_template (id, claim_type, version, name, enabled) VALUES
 (1, 'TRAVEL_APPLY', 1, '出差申请-领导学院', 1),
 (2, 'TRAVEL_CLAIM', 1, '差旅报销-领导财务', 1);

INSERT INTO wf_node (template_id, node_code, node_name, sort_no, role_code, timeout_hours) VALUES
 (1, 'LEADER', '部门领导', 1, 'APPROVER', 24),
 (1, 'COLLEGE', '学院审批', 2, 'COLLEGE', 24),
 (2, 'LEADER', '部门领导', 1, 'APPROVER', 24),
 (2, 'FINANCE', '财务复核', 2, 'FINANCE', 48);

INSERT INTO claim_material_rule (claim_type, rule_version, material_code, material_name, requirement_level, enabled) VALUES
 ('TRAVEL_CLAIM', 1, 'INVOICE', '发票', 'REQUIRED', 1);
