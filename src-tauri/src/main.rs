// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tracing_subscriber;

mod commands;
mod models;
mod services;
mod utils;

fn main() {
    // Initialize tracing for logging
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .init();

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
            // Config commands
            commands::config::get_config,
            commands::config::update_config,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
