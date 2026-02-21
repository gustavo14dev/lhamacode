---
name: data-ingestion
description: Strategies for ingesting complex data (PDFs, Web) and retrieving Just-in-Time context from Enterprise APIs (VTEX, ERPs).
---

# 📥 Data Ingestion & Context Retrieval

This skill is the bridge between "Raw Data" and "LLM Context". It covers **Static Ingestion** (Building indices) and **Dynamic Retrieval** (Fetching live data).

## 📄 Static Ingestion (Files & Documents)

### 1. Complex Document Parsing (OCR/PDF)
Standard Python libraries (`pypdf`) fail on tables and layouts. Use industry-standard tools:

- **Docling (IBM) - RECOMMENDED**: The new standard for deep document understanding.
    - *Why*: Specialized in scientific papers, multi-column layouts, and complex tables. Exports to JSON/Markdown with high fidelity.
    - *Power*: Runs locally or via API. Excellent for preserving reading order.
- **LlamaParse**: Excellent alternative, specifically optimized for RAG.
- **Unstructured.io**: Best valid open-source Swiss Army knife for handling 25+ file types (PPTX, DOCX, HTML).

### 2. Web Scraping & Crawling
For ingesting docs, wikis, or competitor sites.

- **Firecrawl**: Turns any website into LLM-ready Markdown. Handles JS rendering and sub-pages automatically.
- **Playwright**: For custom scraping of complex, authenticated SPAs (Single Page Apps).

## 🔌 Dynamic Retrieval (External APIs & ERPs)

In Enterprise RAG, the answer isn't always in a vector DB. It's often in a SQL DB or an API.

### The "Just-in-Time" (JIT) Context Pattern
Instead of embedding everything (which goes stale), fetch data **during query time** and inject it into the system prompt.

#### 🛍️ E-Commerce & Retail (VTEX, Shopify)
- **Use Case**: "What is the status of my order?" or "Do we have stock of the iPhone 15?"
- **Integration**:
    1.  **Tool Call**: Agent detects intent -> calls `get_order_status(orderId)`.
    2.  **VTEX API**: Query `GET /oms/pvt/orders/{orderId}`.
    3.  **Context Injection**: JSON response is minified and added to the prompt context.
    - *Tip*: Do NOT embed product catalogs with high volatility (price/stock). Use JIT retrieval (Search API) for that.

#### 🏢 SAP / ERP / CRMs
- **Use Case**: "Summarize the last 5 interactions with this client."
- **Integration**:
    - Connect to Salesforce/HubSpot API.
    - Fetch strictly the *text* fields (notes, emails).
    - **Security**: ALWAYS verify the user's JWT token has permission to view that record before fetching.

## 🔄 ETL Pipelines for LLMs

Don't run ingestion scripts manually. Use orchestration.

- **Airflow / Prefect**: Schedule nightly jobs to re-scrape websites or re-index updated PDFs.
- **Change Data Capture (CDC)**: For SQL databases, listen to the transaction log (Debezium) to update vectors immediately when a row changes.

## 🔗 Related Skills

| Need | Skill |
| :--- | :--- |
| Chunking & retrieval strategies | `rag-patterns` |
| Vector DB to index into | `vector-databases` |
| Security during ingestion | `ai-security` (§Data Poisoning) |
| Evaluation of ingested data quality | `rag-evaluation` |
