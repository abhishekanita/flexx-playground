export interface CloudinaryUploadParams {
	folder?: string;
	public_id?: string;
	resource_type?: 'image' | 'video' | 'raw' | 'auto';
	format?: string;
	transformation?: any[];
	tags?: string[];
	context?: Record<string, string>;
	metadata?: Record<string, string>;
  }
  
  export interface CloudinarySignatureResponse {
	signature: string;
	timestamp: number;
	api_key: string;
	cloud_name: string;
	folder?: string;
	public_id?: string;
	upload_url: string;
  }
  
  export interface CloudinaryUploadResult {
	public_id: string;
	version: number;
	signature: string;
	width?: number;
	height?: number;
	format: string;
	resource_type: string;
	created_at: string;
	tags: string[];
	bytes: number;
	type: string;
	etag: string;
	placeholder: boolean;
	url: string;
	secure_url: string;
	access_mode: string;
	original_filename: string;
	api_key: string;
  }
  
  export interface UploadSignatureRequest {
	folder?: string;
	public_id?: string;
	resource_type?: 'image' | 'video' | 'raw' | 'auto';
	tags?: string[];
	transformation?: any[];
  }
  
  export interface UploadError {
	message: string;
	code?: string;
	http_code?: number;
  }