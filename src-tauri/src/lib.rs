use std::time::Duration;

use aws_sdk_s3::{
    config::{BehaviorVersion, Builder as S3ConfigBuilder, Credentials, Region},
    presigning::PresigningConfig,
    primitives::ByteStream,
    Client,
};
use aws_smithy_async::rt::sleep::TokioSleep;
use aws_smithy_types::retry::RetryConfig;
use aws_smithy_types::timeout::TimeoutConfig;
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct S3Credentials {
    access_key_id: String,
    secret_access_key: String,
    endpoint: String,
    region: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct S3Request {
    credentials: S3Credentials,
    action: String,
    #[serde(default)]
    params: Value,
}

fn create_client(credentials: &S3Credentials) -> Result<Client, String> {
    let endpoint = credentials.endpoint.trim().trim_end_matches('/');
    let region = credentials.region.trim();
    let region = if region.is_empty() {
        "us-east-1"
    } else {
        region
    };
    let credentials_provider = Credentials::new(
        credentials.access_key_id.trim(),
        credentials.secret_access_key.trim(),
        None,
        None,
        "s3-browser",
    );
    let timeout_config = TimeoutConfig::builder()
        .connect_timeout(Duration::from_secs(10))
        .operation_timeout(Duration::from_secs(15))
        .build();
    let config = S3ConfigBuilder::new()
        .behavior_version(BehaviorVersion::latest())
        .region(Region::new(region.to_string()))
        .credentials_provider(credentials_provider)
        .endpoint_url(endpoint)
        .sleep_impl(TokioSleep::new())
        .timeout_config(timeout_config)
        .retry_config(RetryConfig::disabled())
        .force_path_style(true)
        .build();

    Ok(Client::from_conf(config))
}

fn param<'a>(params: &'a Value, name: &str) -> Result<&'a str, String> {
    params
        .get(name)
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("缺少参数: {name}"))
}

fn format_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[tauri::command]
async fn s3_request(request: S3Request) -> Result<Value, String> {
    execute_s3_request(request).await
}

pub async fn execute_s3_request(request: S3Request) -> Result<Value, String> {
    let client = create_client(&request.credentials)?;

    match request.action.as_str() {
        "listBuckets" => {
            let response = client.list_buckets().send().await.map_err(format_error)?;
            let buckets = response
                .buckets()
                .iter()
                .map(|bucket| {
                    json!({
                        "Name": bucket.name().unwrap_or_default(),
                        "CreationDate": bucket
                            .creation_date()
                            .and_then(|date| date.to_millis().ok())
                            .unwrap_or_default()
                    })
                })
                .collect::<Vec<_>>();
            Ok(json!({ "buckets": buckets }))
        }
        "testBucket" => {
            client
                .list_objects_v2()
                .bucket(param(&request.params, "bucket")?)
                .max_keys(1)
                .send()
                .await
                .map_err(format_error)?;
            Ok(json!({ "success": true }))
        }
        "listObjects" => {
            let bucket = param(&request.params, "bucket")?;
            let prefix = request
                .params
                .get("prefix")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let response = client
                .list_objects_v2()
                .bucket(bucket)
                .prefix(prefix)
                .delimiter("/")
                .send()
                .await
                .map_err(format_error)?;
            let contents = response
                .contents()
                .iter()
                .map(|object| {
                    json!({
                        "Key": object.key().unwrap_or_default(),
                        "LastModified": object
                            .last_modified()
                            .and_then(|date| date.to_millis().ok())
                            .unwrap_or_default(),
                        "ETag": object.e_tag().unwrap_or_default(),
                        "Size": object.size().unwrap_or_default(),
                        "StorageClass": object
                            .storage_class()
                            .map(|value| value.as_str())
                            .unwrap_or_default()
                    })
                })
                .collect::<Vec<_>>();
            let common_prefixes = response
                .common_prefixes()
                .iter()
                .map(|folder| json!({ "Prefix": folder.prefix().unwrap_or_default() }))
                .collect::<Vec<_>>();

            Ok(json!({
                "contents": contents,
                "commonPrefixes": common_prefixes
            }))
        }
        "getDownloadUrl" => {
            let config =
                PresigningConfig::expires_in(Duration::from_secs(3600)).map_err(format_error)?;
            let request = client
                .get_object()
                .bucket(param(&request.params, "bucket")?)
                .key(param(&request.params, "key")?)
                .presigned(config)
                .await
                .map_err(format_error)?;
            Ok(json!({ "url": request.uri().to_string() }))
        }
        "deleteObject" => {
            client
                .delete_object()
                .bucket(param(&request.params, "bucket")?)
                .key(param(&request.params, "key")?)
                .send()
                .await
                .map_err(format_error)?;
            Ok(json!({ "success": true }))
        }
        "uploadFile" => {
            let body = param(&request.params, "body")?;
            let body = STANDARD.decode(body).map_err(format_error)?;
            let mut operation = client
                .put_object()
                .bucket(param(&request.params, "bucket")?)
                .key(param(&request.params, "key")?)
                .body(ByteStream::from(body));
            if let Some(content_type) = request.params.get("contentType").and_then(Value::as_str) {
                operation = operation.content_type(content_type);
            }
            operation.send().await.map_err(format_error)?;
            Ok(json!({ "success": true }))
        }
        _ => Err("无效的操作".to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![s3_request])
        .run(tauri::generate_context!())
        .expect("failed to run S3 Browser");
}
