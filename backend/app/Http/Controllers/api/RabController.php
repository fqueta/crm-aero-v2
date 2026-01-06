<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Qlib\Qlib;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

class RabController extends Controller
{
    public function index(Request $request){
        $rab = $request->get('matricula') ? $request->get('matricula') : 'PRHNA';
        $link = 'https://sistemas.anac.gov.br/aeronaves/cons_rab_resposta.asp?textMarca='.$rab.'&selectHabilitacao=&selectIcao=&selectModelo=&selectFabricante=&textNumeroSerie=';
        // $dom = new Dom;
        // $dom->loadFromUrl($link);
        if(!defined('CURL_SSLVERSION_TLSv1_2')){
            define('CURL_SSLVERSION_TLSv1_2',1.2);
        }
        $response = Http::withOptions([
            'curl' => [
                CURLOPT_SSLVERSION => CURL_SSLVERSION_TLSv1_2, // Força o TLS 1.2
            ],
        ])->get($link);
        $html = $response->body();
        $crawler = new Crawler($html);
        $selet =  '.retorno-pesquisa table tbody tr';
        $ret = [
            'exec' => false,
            'data' => [],
        ];
        $dados = $crawler->filter($selet)->each(function ($node) {
            return $node->text();
        });
        if($dados){
            $ret['data']['Matrícula'] = $rab;
            foreach ($dados as $k => $v) {
                $arr_d = explode(':',$v);
                $key = trim($arr_d[0]);
                $value = trim(@$arr_d[1]);
                if($k==0){
                    if(!empty(@$arr_d[1])){
                        $ret['exec'] = true;
                    }else{
                        $ret['exec'] = false;
                    }
                }
                $ret['data'][$key] = $value;
            }
            $ret['data']['Data da consulta'] = Qlib::dataLocal();
        }
        return response()->json($ret);
    }

}
