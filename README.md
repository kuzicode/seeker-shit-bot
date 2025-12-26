# Seeker Trade

Solana USDC/USDT Auto Swap Bot，使用 Jupiter API。

## 功能特点

- 支持 USDC ↔ USDT 双向交换
- 固定交易金额：0.001 USDC/USDT
- 支持单次交换和批量交换模式
- 批量模式支持自定义交易次数
- 优化tm的gas，在 .env 自己定义 SWAP_AMOUNT 就行了，默认已经是最低值
- 预计单笔损耗：~$0.0007，200笔损耗 <$0.2


## 安装

```bash
npm install
```

## 配置

1. 复制环境变量示例文件：

```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填写以下配置：

```env
# Solana 钱包助记词（24个单词）
SOLANA_MNEMONIC=your fucking 24 words mnemonic phrase here

# Jupiter API Key (从 https://portal.jup.ag/api-keys 获取)
JUP_API_KEY=your_jupiter_api_key

# Solana RPC URL（可选，默认使用主网）
RPC_URL=https://api.mainnet-beta.solana.com

# HTTP 代理（可选）
PROXY_URL=http://127.0.0.1:7890
```

⚠️ **安全提示**：请勿将真实的助记词或 API Key 提交到版本控制系统！

## 使用方法

### 单次交换模式

**USDC → USDT：**

```bash
npm run start -- USDC_TO_USDT
```

**USDT → USDC：**

```bash
npm run start -- USDT_TO_USDC
```

### 批量交换模式

运行后会进入交互模式，可以设置交易次数和间隔：

```bash
npm run start
```

交互提示：
1. 输入交易次数（默认 200 笔，最多 1000 笔）
2. 输入每笔交易间隔（默认 3000ms）
3. 确认后开始执行

> ⚠️ **API 限制**：Jupiter API 限制 5 分钟 100 笔交易，默认 3 秒间隔可确保 200 笔交易在 10 分钟内安全完成。

批量模式会自动交替进行 USDC → USDT 和 USDT → USDC 交易。

## 配置选项

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `SOLANA_MNEMONIC` | 钱包助记词（24词） | - |
| `JUP_API_KEY` | Jupiter API Key | `https://portal.jup.ag/dashboard` |
| `RPC_URL` | Solana RPC 地址 | `https://api.mainnet-beta.solana.com` |
| `PROXY_URL` | HTTP 代理地址 | - |
| `SWAP_AMOUNT` | 每笔交易金额 (USDC/USDT) | `0.001` |
| `PRIORITY_FEE` | 优先费 (lamports, 0=auto) | `1000` |
| `BATCH_COUNT` | 批量模式目标成功笔数 | `200` |
| `MAX_RETRIES` | 每笔失败后最大重试次数 | `3` |
| `SWAP_DELAY_MS` | 交易间隔 (毫秒) | `3000` |
| `SLIPPAGE_BPS` | 滑点 (基点, 50=0.5%) | `50` |





## License

没有的兄弟，没有的

