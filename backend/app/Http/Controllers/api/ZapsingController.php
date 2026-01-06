<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\MatriculasController;
use App\Jobs\GeraPdfContratoJoub;
use App\Jobs\SendZapsingJoub;
use App\Qlib\Qlib;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
class ZapsingController extends Controller
{

    public $api_id;
    public $url_api;
    public $campo_processo;
    public $campo_processo_periodos;
    public $campo_envio;
    public $campo_links;
    public function __construct()
    {
        $cred = $this->credenciais();
        $this->api_id = isset($cred['id_api']) ? $cred['id_api'] : null;
        $this->url_api = isset($cred['url_api']) ? $cred['url_api'] : null;
        $this->api_id = str_replace('{id}',$this->api_id,'Bearer {id}');
        $this->campo_processo = 'processo_assinatura';
        $this->campo_processo_periodos = 'processo_assinatura_periodos';
        $this->campo_links = 'salvar_links_assinados';
        $this->campo_envio = 'enviar_envelope';
        // if(isset($_GET['te']))
        // dd($this->url_api);
    }
    private function credenciais(){
        $d = Qlib::qoption('credencias_zapsing');
        if($d){
            return Qlib::lib_json_array($d);
        }else{
            return false;
        }
    }
    /**
     * Metodo para realizar as requisições post na api
     * @return $config = ['endpoint' => '', 'body' => [''], 'headers' =>'']
     * @uso (new ZapsingController)->post(['body' =>'']);
     */
    public function post($config){
        $endpoint = isset($config['endpoint']) ? $config['endpoint'] : 'docs'; //'docs'
        $body = isset($config['body']) ? $config['body'] : [];
        $ret['exec'] = false;
        $ret['mens'] = 'Endpoint não encontrado';
        $ret['color'] = 'danger';
        if($endpoint){

            $body = isset($config['body']) ? $config['body'] : [];
            $url_pdf = false;
            // if(isset($config['gerar_pdf']['conteudo']) && ($cont=$config['gerar_pdf']['conteudo'])){
            //     //$config['gerar_pdf'] = ['titulo' => '','conteudo' =>''];
            //     $arquivo = isset($config['gerar_pdf']['arquivo']) ? $config['gerar_pdf']['arquivo'] : 'termo.php';
            //     $new_pdf = (new PdfController)->salvarPdf($config['gerar_pdf'],['arquivo'=>$arquivo]);
            //     $url_pdf = isset($new_pdf['caminho']) ? $new_pdf['caminho'] : false;
            //     if($url_pdf){
            //         $body["url_pdf"] = $url_pdf;
            //     }
            // }
            // $body["url_pdf"] = 'https://oficina.aeroclubejf.com.br/storage/pdfs/termo_pdf';
            $body["folder_path"] = isset($body["folder_path"]) ? $body["folder_path"] : "/".config('app.id_app');
            $body["lang"] = isset($body["lang"]) ? $body["lang"] : "pt-br";
            $body["brand_logo"] = isset($body["brand_logo"]) ? $body["brand_logo"] : 'https://oficina.aeroclubejf.com.br/vendor/adminlte/dist/img/AdminLTELogo.png';//asset(config('adminlte.logo_img'));
            $body["brand_name"] = isset($body["brand_name"]) ? $body["brand_name"] : config('app.name');
            $body["brand_primary_color"] = isset($body["brand_primary_color"]) ? $body["brand_primary_color"] : "#073b5b";
            // $body["disable_signer_emails"] = isset($body["disable_signer_emails"]) ? $body["disable_signer_emails"] : false;
            // $body["created_by"] = isset($body["created_by"]) ? $body["created_by"] : "";
            // $body["date_limit_to_sign"] = isset($body["date_limit_to_sign"]) ? $body["date_limit_to_sign"] : '';
            $body["signature_order_active"] = isset($body["signature_order_active"]) ? $body["signature_order_active"] : true;
            // $body["observers"] = isset($body["observers"]) ? $body["observers"] : [
            //     "fernando@maisaqui.com.br"
            // ];
            // $body["reminder_every_n_days"] = isset($body["reminder_every_n_days"]) ? $body["reminder_every_n_days"] : 0;
            // $body["allow_refuse_signature"] = isset($body["allow_refuse_signature"]) ? $body["allow_refuse_signature"] : false;
            // $body["disable_signers_get_original_file"] = isset($body["disable_signers_get_original_file"]) ? $body["disable_signers_get_original_file"] : false;
            try {
                //code...
                $urlEndpoint = $this->url_api.'/'.$endpoint;
                $response = Http::withHeaders([
                    'Content-Type' => 'application/json',
                    'Authorization' => $this->api_id,
                ])->post($urlEndpoint, $body);
                if($response){
                    $ret['exec'] = true;
                    $ret['mens'] = 'Documento enviado com sucesso';
                    $ret['color'] = 'success';
                }else{
                    $ret['exec'] = false;
                }
                $ret['body'] =  $body;
                $ret['endp'] = $urlEndpoint;
                $ret['response_json'] = $response;
                $ret['response_code'] = base64_encode($response);
                $ret['response'] =  Qlib::lib_json_array($response);
            } catch (\Throwable $e) {
                $ret['error'] = $e->getMessage();
                $ret['body'] =  $body;
                $ret['endp'] = $urlEndpoint;
            }
            Log::info('postZapsingControllerPost', $ret);
            return $ret;
        }else{
            return $ret;
        }
    }
    public function webhook(){
        $ret['exec'] = false;
		@header("Content-Type: application/json");
		$json = file_get_contents('php://input');
        $d = [];
        if($json){
            $d = Qlib::lib_json_array($json);
        }
        Log::info('Webhook zapsing:', $d);
        $ret['exec'] = false;
        $token = isset($d['external_id']) ? $d['external_id'] : false;
        $tk_periodo = false;
        if($token){
            $arr_token = explode('_',$token);
            $token = isset($arr_token[0]) ? $arr_token[0] : false;
            $tk_periodo = isset($arr_token[1]) ? $arr_token[1] : false;
        }
        $signed_file = isset($d['signed_file']) ? $d['signed_file'] : false;
        if($token && $signed_file){
            //baixar e salver
            $ret = $this->baixar_assinados($d,$tk_periodo);
            //salvar hisorico do webhook
            $post_id = Qlib::get_matricula_id_by_token($token);
            if($tk_periodo){
                $ret['salvar_webhook'] = Qlib::update_matriculameta($post_id, 'processo_assinatura_'.$tk_periodo,$json);
            }else{
                $ret['salvar_webhook'] = Qlib::update_matriculameta($post_id, $this->campo_processo,$json);
            }
        }
        return $ret;
    }
    /**
     * aciona as filas para gerar os contratos PDF e para enviar para o zapsing
     */
    public function gerar_doc_envia_zapsing($token){
        $ret['exec']=false;
        if($token){
            //verificar envio de envelope
            $id_matricula = Qlib::get_matricula_id_by_token($token);
            $verificar = false;
            if($id_matricula){
                $verificar = Qlib::get_matriculameta($id_matricula,'enviar_envelope');
                $ret['mens'] = 'Ja foi enviado um envelope com esse conteúdo!';
            }
            if(!$verificar){
                try {
                    GeraPdfContratoJoub::dispatch($token);
                    SendZapsingJoub::dispatch($token)->delay(now()->addSeconds(5));
                    $ret = ['exec'=>true,'mens'=>'Enviado com sucesso!'];
                } catch (\Throwable $th) {
                    //throw $th;
                    $ret = ['exec'=>false,'mens'=>'Erro ao enviar!','error'=>$th->getMessage()];
                }
            }
        }
        return $ret;
    }
    /**
     * metodo para baixar todos documentos assinados atravez da webhook
     */
    public function baixar_assinados($config=[],$tk_periodo=false){
        $token = isset($config['external_id']) ? $config['external_id'] : false;
        $tk_periodo = false;
        $signed_file = isset($config['signed_file']) ? $config['signed_file'] : false;
        $name = isset($config['name']) ? $config['name'] : false;
        $extra_docs = isset($config['extra_docs']) ? $config['extra_docs'] : [];
        $arr_token = explode('_',$token);
        if(isset($arr_token[0])){
            $token = $arr_token[0];
        }
        if(isset($arr_token[1])){
            $tk_periodo = $arr_token[1];
        }
        $mc = new MatriculasController;
        $name = str_replace('.pdf', '', $name);
        $ret = $mc->baixar_arquivo($token, $signed_file,$name,false,$tk_periodo);
        if(isset($ret['link'])){
            $arr = [
                'principal' => ['nome'=>$name,'link'=>$ret['link']],
            ];
            if(is_array($extra_docs)){
                foreach ($extra_docs as $k => $v) {
                    $name = isset($v['name']) ? $v['name'] : false;
                    $name = str_replace('.pdf', '', $name);
                    $signed_file = isset($v['signed_file']) ? $v['signed_file'] : false;
                    $ba = $mc->baixar_arquivo($token, $signed_file,$name,false,$tk_periodo);
                    if(isset($ba['link'])){
                        $open_id = isset($v['open_id']) ? $v['open_id'] : 0;
                        $arr['extra'][$open_id] = ['nome'=>$name, 'link'=>$ba['link']];
                    }
                }
            }
            $post_id = Qlib::get_matricula_id_by_token($token);
            //salvar o array com todos o links dos contratos assinados..
            // dd($tk_periodo);
            $ret['arr'] = $arr;
            if($tk_periodo){
                $slug = $this->campo_links.'_'.$tk_periodo;
                $ret['salvar_links_assinados'] = Qlib::update_matriculameta($post_id,$slug,Qlib::lib_array_json($arr));
                $ret['slug'] = $slug;

            }else{
                $ret['salvar_links_assinados'] = Qlib::update_matriculameta($post_id,$this->campo_links,Qlib::lib_array_json($arr));
            }
        }
        return $ret;
    }
    /**
     * Verifica os dodos do documento remoto
     * @param string $token do documento
     */
    public function status_doc_remoto($token){
        $ret = ['exec'=>false];
        if($token){

            $endpoint = str_replace('{{doc_token}}',$token,'docs/{{doc_token}}');
            $link = $this->url_api.'/'.$endpoint;
            // dump($link);
            try {
            //code...
                $response = Http::withHeaders([
                    // 'Content-Type' => 'application/json',
                    'Authorization' => $this->api_id,
                ])
                ->acceptJson()
                ->get($link);
                if($response){
                    $ret['exec'] = true;
                    $ret['mens'] = 'Documento enviado com sucesso';
                    $ret['color'] = 'success';
                }else{
                    $ret['exec'] = false;
                }
                // $ret['body'] =  $body;
                $ret['response_json'] = $response;
                $ret['response_code'] = base64_encode($response);
                $ret['response'] =  Qlib::lib_json_array($response);
            } catch (\Throwable $e) {
                $ret['error'] = $e->getMessage();
            }
        }
        return $ret;
    }
    /**
     * Cria um array com os dados de todos quan são os signatarios.
     */
    public function signers_matricula($sing=[],$type=1){
        $id_contatada = Qlib::qoption('id_contatada') ? Qlib::qoption('id_contatada') : 14;
        $id_testemunha1 = Qlib::qoption('id_testemunha1') ? Qlib::qoption('id_testemunha1') : 137;
        $id_testemunha2 = Qlib::qoption('id_testemunha2') ? Qlib::qoption('id_testemunha2') : 95;
        $dcont = Qlib::dados_tab_SERVER('usuarios_sistemas','*',"WHERE id='".$id_contatada."'");
        $dtes1 = Qlib::dados_tab_SERVER('usuarios_sistemas','*',"WHERE id='".$id_testemunha1."' AND ".Qlib::compleDelete());
        $dtes2 = Qlib::dados_tab_SERVER('usuarios_sistemas','*',"WHERE id='".$id_testemunha2."' AND ".Qlib::compleDelete());
        if($type==1){
            //para assinaturas dos documentos a serem enviados no zapsing
            $ret[0]=$sing;
            if($dcont){
                $arr_dcont = [
                    "name" => $dcont[0]['nome'],
                    "email" => $dcont[0]['email'],
                    "cpf" => $dcont[0]['cpf'],
                    "send_automatic_email" => true,
                    "send_automatic_whatsapp" => false,
                    "auth_mode" => "CPF", //tokenEmail,assinaturaTela-tokenEmail,tokenSms,assinaturaTela-tokenSms,tokenWhatsapp,assinaturaTela-tokenWhatsapp,CPF,assinaturaTela-cpf,assinaturaTela
                    "order_group" => 2,
                ];
                array_push($ret,$arr_dcont);
            }
            if($dtes1){
                $arr_dtes1 = [
                    "name" => $dtes1[0]['nome'],
                    "email" => $dtes1[0]['email'],
                    "cpf" => $dtes1[0]['cpf'],
                    "send_automatic_email" => true,
                    "send_automatic_whatsapp" => false,
                    "auth_mode" => "CPF", //tokenEmail,assinaturaTela-tokenEmail,tokenSms,assinaturaTela-tokenSms,tokenWhatsapp,assinaturaTela-tokenWhatsapp,CPF,assinaturaTela-cpf,assinaturaTela
                    "order_group" => 3,
                ];
                array_push($ret,$arr_dtes1);
            }
            if($dtes2){
                $arr_dtes2 = [
                    "name" => $dtes2[0]['nome'],
                    "email" => $dtes2[0]['email'],
                    "cpf" => $dtes2[0]['cpf'],
                    "send_automatic_email" => true,
                    "send_automatic_whatsapp" => false,
                    "auth_mode" => "CPF", //tokenEmail,assinaturaTela-tokenEmail,tokenSms,assinaturaTela-tokenSms,tokenWhatsapp,assinaturaTela-tokenWhatsapp,CPF,assinaturaTela-cpf,assinaturaTela
                    "order_group" => 4,
                ];
                array_push($ret,$arr_dtes2);
            }
        }
        if($type == 2){
            //para assinaturas nos documentos do crm
        }
        return $ret;
        // dump($ret);
        // dd($dcont,$dtes1,$dtes2);
    }
    /**
     * Envia anexos a um determinado documento
     * @param  string $token_envelope = '' token do documento inicial
     * @param  string $url_pdf = '' url do pdf do documento a ser anexado
     * @param  string $nome_arquivo = '' Nome do arquivo
     * @param  array $ret = []
     */
    public function enviar_anexo($token_envelope,$url_pdf=false,$nome_arquivo='Arquivo anexo'){
        $body = [
            'name'=>$nome_arquivo,
            'url_pdf'=>$url_pdf,
        ];
        $endpoint = 'docs/'.$token_envelope.'/upload-extra-doc';
        $ret = (new ZapsingController)->post([
            "endpoint" => $endpoint,
            "body" => $body,
        ]);
        return $ret;
    }


}
