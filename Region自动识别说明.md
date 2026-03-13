# ✨ Region 自动识别功能

## 🎯 功能说明

现在您**不需要手动填写 Region** 了!

当您输入 Endpoint 地址时,系统会**自动识别并填写** Region 字段。

---

## 📝 使用示例

### 示例 1: 华为云 OBS

**您输入**:
```
Endpoint: https://obs.cn-north-4.myhuaweicloud.com
```

**系统自动识别**:
```
Region: cn-north-4  ✓
```

---

### 示例 2: 华为云上海

**您输入**:
```
Endpoint: https://obs.cn-east-3.myhuaweicloud.com
```

**系统自动识别**:
```
Region: cn-east-3  ✓
```

---

### 示例 3: AWS S3

**您输入**:
```
Endpoint: https://s3.us-west-2.amazonaws.com
```

**系统自动识别**:
```
Region: us-west-2  ✓
```

---

## 💡 工作原理

系统会分析您输入的 Endpoint 地址,从中提取 Region 信息:

- **华为云格式**: `obs.{region}.myhuaweicloud.com`
- **AWS 格式**: `s3.{region}.amazonaws.com`
- **AWS 旧格式**: `s3-{region}.amazonaws.com`

---

## ⚙️ 特殊情况

如果您使用的是 MinIO 或其他自建 S3 服务:

```
Endpoint: http://192.168.1.100:9000
```

这种情况下 Region 无法自动识别,您可以:
1. 保持默认值 `us-east-1`
2. 或者手动修改(需要改代码去掉 readOnly 属性)

---

## 🚀 现在就试试!

1. 打开 S3 Browser 应用
2. 在 **REST Endpoint** 字段输入您的华为云地址
3. 看 **Region** 字段自动填充!
4. 填写 Access Key 和 Secret Key
5. 点击"添加账户"

就这么简单! 😊
