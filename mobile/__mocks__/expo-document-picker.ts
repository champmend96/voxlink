export async function getDocumentAsync() {
  return {
    canceled: false,
    assets: [
      {
        uri: "file:///mock/document.pdf",
        name: "document.pdf",
        mimeType: "application/pdf",
        size: 12345,
      },
    ],
  };
}
