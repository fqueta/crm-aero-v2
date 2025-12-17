<?php

// Detect OS family to provide sensible default wkhtmltopdf/wkhtmltoimage paths.
// Windows uses the default installer path; Linux typically installs to /usr/bin.
// These act as fallbacks if the corresponding env vars are not set.
$osFamily = PHP_OS_FAMILY;
$defaultPdfBinary = $osFamily === 'Windows'
    ? 'C:\\Program Files\\wkhtmltopdf\\bin\\wkhtmltopdf.exe'
    : '/usr/bin/wkhtmltopdf';
$defaultImgBinary = $osFamily === 'Windows'
    ? 'C:\\Program Files\\wkhtmltopdf\\bin\\wkhtmltoimage.exe'
    : '/usr/bin/wkhtmltoimage';

return [

    /*
    |--------------------------------------------------------------------------
    | Snappy PDF / Image Configuration
    |--------------------------------------------------------------------------
    |
    | This option contains settings for PDF generation.
    |
    | Enabled:
    |    
    |    Whether to load PDF / Image generation.
    |
    | Binary:
    |    
    |    The file path of the wkhtmltopdf / wkhtmltoimage executable.
    |
    | Timeout:
    |    
    |    The amount of time to wait (in seconds) before PDF / Image generation is stopped.
    |    Setting this to false disables the timeout (unlimited processing time).
    |
    | Options:
    |
    |    The wkhtmltopdf command options. These are passed directly to wkhtmltopdf.
    |    See https://wkhtmltopdf.org/usage/wkhtmltopdf.txt for all options.
    |
    | Env:
    |
    |    The environment variables to set while running the wkhtmltopdf process.
    |
    */
    
    'pdf' => [
        'enabled' => true,
        // OS-aware default path; override via env WKHTML_PDF_BINARY
        'binary'  => env('WKHTML_PDF_BINARY', $defaultPdfBinary),
        // Limit to 120s to avoid hanging processes
        'timeout' => 120,
        'options' => [
            'encoding' => 'utf-8',
            'print-media-type' => true,
            'enable-local-file-access' => true,
            'images' => true,
            'dpi' => 96,
            'image-quality' => 100,
            'margin-top' => '0mm',
            'margin-right' => '0mm',
            'margin-bottom' => '0mm',
            'margin-left' => '0mm',
        ],
        'env'     => [],
    ],
    
    'image' => [
        'enabled' => true,
        // OS-aware default path; override via env WKHTML_IMG_BINARY
        'binary'  => env('WKHTML_IMG_BINARY', $defaultImgBinary),
        'timeout' => 60,
        'options' => [],
        'env'     => [],
    ],

];
