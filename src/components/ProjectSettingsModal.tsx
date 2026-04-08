'use client';
import React, { useEffect } from 'react';
import { Modal, Form, InputNumber, Row, Col, Typography, Input, Space } from 'antd';
import { useAppStore, INITIAL_FINANCIAL_CONFIG, INITIAL_PROJECT_META, type FinancialConfig, type ProjectMeta } from '@/lib/store';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface ProjectSettingsModalProps {
    open: boolean;
    onClose: () => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ open, onClose }) => {
    const tCommon = useTranslations('common');
    const tSettings = useTranslations('common.projectSettings');
    const [form] = Form.useForm();
    const financialConfig = useAppStore(state => state.financialConfig);
    const setFinancialConfig = useAppStore(state => state.setFinancialConfig);
    const projectMeta = useAppStore(state => state.projectMeta);
    const setProjectMeta = useAppStore(state => state.setProjectMeta);

    useEffect(() => {
        if (open) {
            form.setFieldsValue({
                overheadPercent: financialConfig.overheadPercent,
                fixedMonthlyOverhead: financialConfig.fixedMonthlyOverhead,
                profitPercent: financialConfig.profitPercent,
                taxPercent: financialConfig.taxPercent,
                contingencyPercent: financialConfig.contingencyPercent,
                projectName: projectMeta.projectName,
                clientName: projectMeta.clientName,
                location: projectMeta.location,
                documentDate: projectMeta.documentDate,
            });
        }
    }, [open, financialConfig, projectMeta, form]);

    const handleSave = () => {
        void form.validateFields().then((values: FinancialConfig & ProjectMeta) => {
            setFinancialConfig({
                overheadPercent: values.overheadPercent,
                fixedMonthlyOverhead: values.fixedMonthlyOverhead,
                profitPercent: values.profitPercent,
                taxPercent: values.taxPercent,
                contingencyPercent: values.contingencyPercent,
            });
            setProjectMeta({
                projectName: values.projectName,
                clientName: values.clientName,
                location: values.location,
                documentDate: values.documentDate,
            });
            onClose();
        });
    };

    return (
        <Modal
            title={<div className="font-bold text-lg mb-2">{tSettings('title')}</div>}
            open={open}
            onOk={handleSave}
            onCancel={onClose}
            okText={tCommon('save')}
            cancelText={tCommon('cancel')}
            centered
        >
            <Form form={form} layout="vertical" className="mt-4"
                initialValues={{
                    ...INITIAL_PROJECT_META,
                    ...INITIAL_FINANCIAL_CONFIG,
                }}
            >
                <Text strong className="block mb-3">{tSettings('metaTitle')}</Text>
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                        <Form.Item label={tSettings('projectName')} name="projectName" style={{ marginBottom: 0 }}>
                            <Input placeholder={tSettings('projectNamePh')} />
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                        <Form.Item label={tSettings('clientName')} name="clientName" style={{ marginBottom: 0 }}>
                            <Input placeholder={tSettings('clientNamePh')} />
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                        <Form.Item label={tSettings('location')} name="location" style={{ marginBottom: 0 }}>
                            <Input placeholder={tSettings('locationPh')} />
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                        <Form.Item label={tSettings('documentDate')} name="documentDate" style={{ marginBottom: 0 }}>
                            <Input type="date" />
                        </Form.Item>
                    </Col>
                </Row>

                <div className="border-t border-[#f0f0f0] my-4" />

                <Text strong className="block mb-3">{tSettings('financeTitle')}</Text>
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                        <Form.Item label={tSettings('overhead')} style={{ marginBottom: 0 }}>
                            <Space.Compact style={{ width: '100%' }}>
                                <Form.Item name="overheadPercent" noStyle>
                                    <InputNumber min={0} max={100} style={{ width: 'calc(100% - 36px)' }} />
                                </Form.Item>
                                <Input style={{ width: '36px', textAlign: 'center', pointerEvents: 'none', background: '#fafafa', padding: 0 }} defaultValue="%" disabled />
                            </Space.Compact>
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                        <Form.Item label="ค่าดำเนินการรายเดือน (Fixed)" style={{ marginBottom: 0 }}>
                            <Space.Compact style={{ width: '100%' }}>
                                <Form.Item name="fixedMonthlyOverhead" noStyle>
                                    <InputNumber min={0} step={1000} style={{ width: 'calc(100% - 50px)' }} />
                                </Form.Item>
                                <Input style={{ width: '50px', textAlign: 'center', pointerEvents: 'none', background: '#fafafa', padding: 0 }} defaultValue="฿/ด." disabled />
                            </Space.Compact>
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                        <Form.Item label={tSettings('profit')} style={{ marginBottom: 0 }}>
                            <Space.Compact style={{ width: '100%' }}>
                                <Form.Item name="profitPercent" noStyle>
                                    <InputNumber min={0} max={100} style={{ width: 'calc(100% - 36px)' }} />
                                </Form.Item>
                                <Input style={{ width: '36px', textAlign: 'center', pointerEvents: 'none', background: '#fafafa', padding: 0 }} defaultValue="%" disabled />
                            </Space.Compact>
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                        <Form.Item label={tSettings('vat')} style={{ marginBottom: 0 }}>
                            <Space.Compact style={{ width: '100%' }}>
                                <Form.Item name="taxPercent" noStyle>
                                    <InputNumber min={0} max={100} style={{ width: 'calc(100% - 36px)' }} />
                                </Form.Item>
                                <Input style={{ width: '36px', textAlign: 'center', pointerEvents: 'none', background: '#fafafa', padding: 0 }} defaultValue="%" disabled />
                            </Space.Compact>
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                        <Form.Item label={tSettings('contingency')} style={{ marginBottom: 0 }}>
                            <Space.Compact style={{ width: '100%' }}>
                                <Form.Item name="contingencyPercent" noStyle>
                                    <InputNumber min={0} max={30} style={{ width: 'calc(100% - 36px)' }} />
                                </Form.Item>
                                <Input style={{ width: '36px', textAlign: 'center', pointerEvents: 'none', background: '#fafafa', padding: 0 }} defaultValue="%" disabled />
                            </Space.Compact>
                        </Form.Item>
                    </Col>
                </Row>
            </Form>
        </Modal>
    );
};
