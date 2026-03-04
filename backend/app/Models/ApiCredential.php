<?php

namespace App\Models;

class ApiCredential extends Post
{
    protected $table = 'posts';
    protected static function booted()
    {
        parent::booted();
        static::addGlobalScope('typeApiCredentials', function ($builder) {
            $builder->where('post_type', 'api_credentials');
        });
    }
}
