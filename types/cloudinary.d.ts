declare module 'cloudinary' {
  export namespace v2 {
    interface UploadApiOptions {
      folder?: string;
      resource_type?: 'image' | 'video' | 'raw' | 'auto';
      [key: string]: any;
    }

    interface UploadApiResponse {
      public_id: string;
      secure_url: string;
      url: string;
      [key: string]: any;
    }

    interface UploadStreamCallback {
      (error?: Error, result?: UploadApiResponse): void;
    }

    interface Uploader {
      upload_stream(
        options: UploadApiOptions,
        callback: UploadStreamCallback
      ): NodeJS.WritableStream;
      destroy(
        publicId: string,
        options?: { resource_type?: 'image' | 'video' | 'raw' | 'auto' }
      ): Promise<any>;
    }

    interface ConfigOptions {
      cloud_name?: string;
      api_key?: string;
      api_secret?: string;
    }

    interface Cloudinary {
      uploader: Uploader;
      config(options: ConfigOptions): void;
    }
  }

  export const v2: v2.Cloudinary;
  export default v2;
}

