import React from 'react';
import { Form, Input, InputNumber, Button, Select, Card, Row, Col, Divider } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { type FootingInput } from '@/types';
import { v4 as uuidv4 } from 'uuid';




interface FootingFormProps {
    onAdd: (footing: FootingInput) => void;
}

export const FootingForm: React.FC<FootingFormProps> = ({ onAdd }) => {
    const [form] = Form.useForm();

    const onFinish = (values: Omit<FootingInput, 'id'>) => {
        const newFooting: FootingInput = {
            id: uuidv4(),
            name: values.name,
            qty: values.qty,
            w: values.w,
            l: values.l,
            t: values.t,
            d: values.d,
            mainBarSize: values.mainBarSize,
            mainBarSpacing: values.mainBarSpacing
        };
        onAdd(newFooting);
        form.resetFields(['name', 'qty']); // Keep dimensions for easier entry of similar items? Or reset all? Let's reset main fields but keep logic simple.
        // Actually, let's reset all for now to avoid confusion
        form.resetFields();
    };

    return (
        <Card title="เพิ่มรายการฐานราก (Add Footing)" variant="borderless" className="shadow-sm">
            <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
                initialValues={{
                    qty: 1,
                    w: 1.0, l: 1.0, t: 0.25, d: 1.0,
                    mainBarSize: 'DB12',
                    mainBarSpacing: 0.15
                }}
            >
                <Row gutter={16}>
                    <Col span={16}>
                        <Form.Item name="name" label="ชื่อฐานราก (Name)" rules={[{ required: true, message: 'ระบุชื่อ' }]}>
                            <Input placeholder="F1, F2..." />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="qty" label="จำนวน (Qty)" rules={[{ required: true }]}>
                            <InputNumber onFocus={(e) => e.target.select()} min={1} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider style={{ margin: '12px 0' }}><span className="text-xs text-gray-400">ขนาด (Dimensions)</span></Divider>

                <Row gutter={12}>
                    <Col span={6}>
                        <Form.Item name="w" label="กว้าง (W)" tooltip="หน่วย: เมตร">
                            <InputNumber onFocus={(e) => e.target.select()} min={0} step={0.1} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="l" label="ยาว (L)" tooltip="หน่วย: เมตร">
                            <InputNumber onFocus={(e) => e.target.select()} min={0} step={0.1} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="t" label="หนา (T)" tooltip="หน่วย: เมตร">
                            <InputNumber onFocus={(e) => e.target.select()} min={0} step={0.05} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="d" label="ลึก (Depth)" tooltip="ระดับขุดดิน (เมตร)">
                            <InputNumber onFocus={(e) => e.target.select()} min={0} step={0.1} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider style={{ margin: '12px 0' }}><span className="text-xs text-gray-400">เหล็กเสริม (Reinforcement)</span></Divider>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="mainBarSize" label="เหล็กแกน (Main Bar)">
                            <Select options={[
                                { value: 'RB6', label: 'RB6' },
                                { value: 'RB9', label: 'RB9' },
                                { value: 'DB12', label: 'DB12' },
                                { value: 'DB16', label: 'DB16' },
                                { value: 'DB20', label: 'DB20' },
                                { value: 'DB25', label: 'DB25' },
                            ]} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="mainBarSpacing" label="ระยะเรียง (Spacing)" tooltip="เมตร (เช่น 0.15)">
                            <InputNumber onFocus={(e) => e.target.select()} min={0.05} max={1.0} step={0.05} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item style={{ marginTop: 16, marginBottom: 0 }}>
                    <Button type="primary" htmlType="submit" block icon={<PlusOutlined />}>
                        เพิ่มรายการ (Add)
                    </Button>
                </Form.Item>
            </Form>
        </Card>
    );
};
