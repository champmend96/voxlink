export const MediaTypeOptions = {
  Images: "Images",
  Videos: "Videos",
  All: "All",
};

export async function launchImageLibraryAsync() {
  return {
    canceled: false,
    assets: [
      {
        uri: "file:///mock/photo.jpg",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        width: 800,
        height: 600,
      },
    ],
  };
}

export async function requestMediaLibraryPermissionsAsync() {
  return { status: "granted" };
}
