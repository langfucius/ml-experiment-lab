function DataUpload() {
  return (
    <section>
      <h1>数据上传</h1>
      <p className="page-description">
        上传 CSV / Excel 数据集，后续会发送到 FastAPI 后端进行解析。
      </p>

      <div className="card">
        <h2>数据来源</h2>
        <p>这里后续支持本地文件上传、API 数据接入和示例数据集。</p>
      </div>
    </section>
  );
}

export default DataUpload;