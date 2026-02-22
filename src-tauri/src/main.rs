// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod services;
mod utils;

fn main() {
    // File logging with daily rotation
    let log_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("com.simples3.app/logs");
    std::fs::create_dir_all(&log_dir).ok();

    let file_appender = tracing_appender::rolling::daily(&log_dir, "simples3.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

    tracing_subscriber::registry()
        .with(EnvFilter::new("debug"))
        .with(fmt::layer().with_writer(std::io::stderr))
        .with(fmt::layer().with_writer(non_blocking).with_ansi(false))
        .init();

    tracing::info!("SimpleS3 starting, logs at: {}", log_dir.display());

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Filesystem commands
            commands::filesystem::list_directory,
            commands::filesystem::get_home_directory,
            commands::filesystem::delete_local_item,
            commands::filesystem::create_directory,
            commands::filesystem::copy_local_items,
            commands::filesystem::check_local_file_exists,
            commands::filesystem::get_disk_space,
            // Config commands
            commands::config::get_config,
            commands::config::update_config,
            commands::config::get_app_state,
            commands::config::save_app_state,
            // Endpoint commands
            commands::endpoints::list_endpoints,
            commands::endpoints::add_endpoint,
            commands::endpoints::update_endpoint,
            commands::endpoints::delete_endpoint,
            commands::endpoints::validate_endpoint,
            commands::endpoints::set_active_endpoint,
            // S3 commands
            commands::s3::list_buckets,
            commands::s3::list_objects,
            commands::s3::copy_s3_object,
            commands::s3::delete_s3_object,
            commands::s3::delete_s3_prefix,
            // Transfer commands
            commands::transfers::upload_file,
            commands::transfers::upload_directory,
            commands::transfers::download_file,
            commands::transfers::download_prefix,
            commands::transfers::pause_transfer,
            commands::transfers::resume_transfer,
            commands::transfers::cancel_transfer,
            commands::transfers::get_transfer_queue,
            commands::transfers::check_object_exists,
            commands::transfers::clear_finished_transfers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
