<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\MatriculasController;
use App\Http\Controllers\api\ZapguruController;
use App\Http\Controllers\api\ApiCredentialController;
use App\Jobs\GeraPdfContratoJoub;
use App\Jobs\SendZapsingJoub;
use App\Models\User;
use App\Services\Qlib;
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
        $cfg = (new ApiCredentialController())->get('zapsign');
        if (!empty($cfg) && !empty($cfg['config']) && is_array($cfg['config'])) {
            $conf = $cfg['config'];
            $url = $conf['url'] ?? ($conf['url_api'] ?? null);
            $id = $conf['id_api'] ?? ($conf['pass'] ?? null);
            if ($url || $id) {
                return ['url_api' => $url, 'id_api' => $id];
            }
        }
        $d = Qlib::qoption('credenciais_zapsign');
        if($d){
            return Qlib::lib_json_array($d);
        }
        return false;
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
            // dd($body,$endpoint);
            try {
                // dd($this->url_api,$endpoint,$this->api_id);
                $urlEndpoint = $this->url_api.'/'.$endpoint;
                // dd($urlEndpoint,$body,$this->api_id);
                $response = Http::withHeaders([
                    'Content-Type' => 'application/json',
                    'Authorization' => $this->api_id,
                ])->post($urlEndpoint, $body);
                // dd($response);
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
    public function webhook($payload=[]){
        $ret['exec'] = false;
        $d = $payload;
        if(empty($payload)){
            $json = file_get_contents('php://input');
            $d = Qlib::lib_json_array($json);
        }
        Log::info('Webhook zapsing', ['payload' => $d]);
        $ret['exec'] = false;
        $token = isset($d['external_id']) ? $d['external_id'] : false;
        $tk_periodo = false;
        $id_matricula = false;
        if($token){
            $arr_token = explode('_',$token);
            $id_matricula = isset($arr_token[0]) ? $arr_token[0] : false;
            $tk_periodo = isset($arr_token[1]) ? $arr_token[1] : false;
        }
        $signed_file = isset($d['signed_file']) ? $d['signed_file'] : false;
        if($id_matricula && $signed_file){
            //baixar e salver
            $ret = $this->baixar_assinados($d,$tk_periodo);
            //salvar hisorico do webhook
            $ret['salvar_webhook'] = Qlib::update_matriculameta($id_matricula, $this->campo_processo,json_encode($d));

        }
        return $ret;
    }
    /**
     * aciona as filas para gerar os contratos PDF e para enviar para o zapsing
     */
    // public function gerar_doc_envia_zapsing($token){
    //     $ret['exec']=false;
    //     if($token){
    //         //verificar envio de envelope
    //         $id_matricula = Qlib::get_matricula_id_by_token($token);
    //         $verificar = false;
    //         if($id_matricula){
    //             $verificar = Qlib::get_matriculameta($id_matricula,'enviar_envelope');
    //             $ret['mens'] = 'Ja foi enviado um envelope com esse conteúdo!';
    //         }
    //         if(!$verificar){
    //             try {
    //                 GeraPdfContratoJoub::dispatch($token);
    //                 SendZapsingJoub::dispatch($token)->delay(now()->addSeconds(5));
    //                 $ret = ['exec'=>true,'mens'=>'Enviado com sucesso!'];
    //             } catch (\Throwable $th) {
    //                 //throw $th;
    //                 $ret = ['exec'=>false,'mens'=>'Erro ao enviar!','error'=>$th->getMessage()];
    //             }
    //         }
    //     }
    //     return $ret;
    // }
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
        $id_matricula = '';
        if(isset($arr_token[0])){
            $id_matricula = $arr_token[0];
        }
        if(isset($arr_token[1])){
            $tk_periodo = $arr_token[1];
        }
        $mc = new MatriculaController;
        $name = str_replace('.pdf', '', $name);
        $ret = $mc->baixar_arquivo($id_matricula, $signed_file,$name,false,$tk_periodo);
        if(isset($ret['link'])){
            $arr = [
                'principal' => ['nome'=>$name,'link'=>$ret['link']],
            ];
            if(is_array($extra_docs)){
                foreach ($extra_docs as $k => $v) {
                    $name = isset($v['name']) ? $v['name'] : false;
                    $name = str_replace('.pdf', '', $name);
                    $signed_file = isset($v['signed_file']) ? $v['signed_file'] : false;
                    $ba = $mc->baixar_arquivo($id_matricula, $signed_file,$name,false,$tk_periodo);
                    if(isset($ba['link'])){
                        $open_id = isset($v['open_id']) ? $v['open_id'] : 0;
                        $arr['extra'][$open_id] = ['nome'=>$name, 'link'=>$ba['link']];
                    }
                }
            }
            //Replace $post_id with $id_matricula to use the same variable for matricula identification
            //salvar o array com todos o links dos contratos assinados..
            // dd($tk_periodo);
            $ret['arr'] = $arr;
            if($tk_periodo){
                $slug = $this->campo_links.'_'.$tk_periodo;
                $ret['salvar_links_assinados'] = Qlib::update_matriculameta($id_matricula,$slug,Qlib::lib_array_json($arr));
                $ret['slug'] = $slug;

            }else{
                $ret['salvar_links_assinados'] = Qlib::update_matriculameta($id_matricula,$this->campo_links,Qlib::lib_array_json($arr));
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
        $id_contatada = 'id_contatada';
        $id_testemunha1 = 'id_testemunha1';
        $id_testemunha2 = 'id_testemunha2';
        // dump($id_contatada,$id_testemunha1,$id_testemunha2);
        $dcont = User::where('token',$id_contatada)->first();
        $dtes1 = User::where('token',$id_testemunha1)->first();
        $dtes2 = User::where('token',$id_testemunha2)->first();
        // dd($dcont,$dtes1,$dtes2);
        if($type==1){
            //para assinaturas dos documentos a serem enviados no zapsing
            $ret[0]=$sing;
            if($dcont){
                $arr_dcont = [
                    "name" => $dcont->name,
                    "email" => $dcont->email,
                    "cpf" => $dcont->cpf,
                    "send_automatic_email" => true,
                    "send_automatic_whatsapp" => false,
                    "auth_mode" => "CPF", //tokenEmail,assinaturaTela-tokenEmail,tokenSms,assinaturaTela-tokenSms,tokenWhatsapp,assinaturaTela-tokenWhatsapp,CPF,assinaturaTela-cpf,assinaturaTela
                    "order_group" => 2,
                ];
                array_push($ret,$arr_dcont);
            }
            if($dtes1){
                $arr_dtes1 = [
                    "name" => $dtes1->name,
                    "email" => $dtes1->email,
                    "cpf" => $dtes1->cpf,
                    "send_automatic_email" => true,
                    "send_automatic_whatsapp" => false,
                    "auth_mode" => "CPF", //tokenEmail,assinaturaTela-tokenEmail,tokenSms,assinaturaTela-tokenSms,tokenWhatsapp,assinaturaTela-tokenWhatsapp,CPF,assinaturaTela-cpf,assinaturaTela
                    "order_group" => 3,
                ];
                array_push($ret,$arr_dtes1);
            }
            if($dtes2){
                $arr_dtes2 = [
                    "name" => $dtes2->name,
                    "email" => $dtes2->email,
                    "cpf" => $dtes2->cpf,
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

    /**
     * Envia o envelope para o ZapSign
     * @param int $id_matricula
     * @return array
     */
    public function enviar_envelope($id_matricula)
    {
        $ret['exec'] = false;
        //converte id_matricula em int
        $id_matricula = (int)$id_matricula;
        // Verify if envelope was already sent
        $verificar = Qlib::get_matriculameta($id_matricula, 'enviar_envelope');
        if ($verificar) {
            if($verificar!='false'){
                $ret['mens'] = 'Envelope já enviado anteriormente.';
                return $ret;
            }
        }

        try {
            $matricula = (new MatriculaController())->dm($id_matricula);
            $cliente = \App\Models\User::find($matricula['id_cliente']);

            if (!$cliente) {
                throw new \Exception("Client not found for Matricula ID: $id_matricula");
            }

            // Fetch PDF URLs from metadata
            $propostaPdfUrl = Qlib::get_matriculameta($id_matricula, 'proposta_pdf');
            $contratosMeta = Qlib::get_matriculameta($id_matricula, 'contrato_pdf');
            $docs = [];

            // Add Proposal PDF
            if ($propostaPdfUrl) {
                $docs[] = [
                    'name' => 'Proposta de Matrícula',
                    'url_pdf' => $propostaPdfUrl,
                ];
            }
            // dd($contratosMeta);
            // Add Contract PDFs
            if ($contratosMeta) {
                $decoded = json_decode($contratosMeta, true);
                if (is_array($decoded)) {
                    foreach ($decoded as $contrato) {
                        if (isset($contrato['url_pdf'])) {
                             $docs[] = [
                                'name' => isset($contrato['nome_contrato']) ? $contrato['nome_contrato'] : 'Contrato',
                                'url_pdf' => $contrato['url_pdf'],
                            ];
                        } elseif (isset($contrato['url'])) {
                             $docs[] = [
                                'name' => isset($contrato['nome_contrato']) ? $contrato['nome_contrato'] : 'Contrato',
                                'url_pdf' => $contrato['url'],
                            ];
                        }
                    }
                } else {
                    $docs[] = [
                        'name' => 'Contrato de Prestação de Serviços',
                        'url_pdf' => $contratosMeta,
                    ];
                }
            }

            if (empty($docs)) {
                throw new \Exception("No documents found for sending to ZapSign (Matricula ID: $id_matricula)");
            }

            // Prepare Signer
            $signer = [
                'name' => $cliente->name,
                'email' => $cliente->email,
                'cpf' => $cliente->cpf,
                'send_automatic_email' => true,
                'send_automatic_whatsapp' => false,
            ];

            $signers = $this->signers_matricula($signer);
            // Prepare Envelope Payload
            $body = [
                'name' => $cliente->name . ' * '.$matricula['curso_nome'].' #'.$id_matricula,
                'url_pdf' => $propostaPdfUrl,
                'folder_path' => '/' . config('app.id_app', 'CRM'),
                'signers' => $signers,
                'docs' => $docs,
                'lang' => 'pt-br',
            ];
            // dd removido para não interromper execução em produção
            $response = $this->post([
                'endpoint' => 'docs',
                'body' => $body
            ]);

            if (isset($response['exec']) && $response['exec']) {
                $responseData = $response['response'] ?? [];

                // Save metadata
                Qlib::update_matriculameta($id_matricula, 'enviar_envelope', json_encode($responseData));

                if (isset($responseData['external_id'])) {
                     Qlib::update_matriculameta($id_matricula, 'processo_assinatura', json_encode($responseData));
                }
                $ret['exec'] = true;
                $ret['mens'] = 'Enviado com sucesso!';
                $ret['response'] = $responseData;
            } else {
                $ret['mens'] = isset($response['mens']) ? $response['mens'] : 'Erro desconhecido ao enviar.';
            }

        } catch (\Throwable $e) {
            $ret['mens'] = $e->getMessage();
        }
        return $ret;
    }
    /**
     * Metodo para adiminstrar um envio de mensagem do zapsing
     * @param string $token
     */
    public function enviar_link_assinatura($id_matricula=null){
        $d = (new MatriculaController())->dm($id_matricula);
        $processo = [];
        if(isset($d['id']) && ($id_matricula = $d['id'])){
            $campo_processo = $this->campo_processo;
            $json_processo = Qlib::get_matriculameta($id_matricula,$campo_processo);
            if($json_processo){
                $processo = Qlib::lib_json_array($json_processo);
            }
        }
        $ret['exec'] = false;
        if(isset($processo['response']['signers']) && isset($processo['response']['external_id'])){
            $webhook_zapsing = $processo['response'];
        }else{
            $webhook_zapsing = isset($d['webhook_zapsing']['enviar']['response']) ? $d['webhook_zapsing']['enviar']['response'] : false;
            if(!$webhook_zapsing){
                $webhook_zapsing = isset($d['webhook_zapsing']) ? $d['webhook_zapsing'] : [];
            }
        }
        $email = isset($d['email']) ? $d['email'] : false;
        $app = config('app.name');
        $temm = 'Olá *{nome}* sua assinatura foi solicitada, pelo *{app}*, para o documento, *{nome_doc}* segue o link de assinatura {link}';
        $i = 0;
        $zgc = new ZapguruController();
        // if($tk_periodo){
        //     $tk = isset($webhook_zapsing['external_id']) ? $webhook_zapsing['external_id'] : false;
        //     $arr_tk = explode('_',$tk);
        //     $external_id = isset($arr_tk[0]) ? $arr_tk[0] : false;
        // }else{
            $external_id = isset($webhook_zapsing['external_id']) ? $webhook_zapsing['external_id'] : false;
        // }
        $nome_doc = isset($webhook_zapsing['name']) ? $webhook_zapsing['name'] : '';
        if(isset($webhook_zapsing['signers'][$i]['sign_url']) && is_string($webhook_zapsing['signers'][$i]['sign_url']) && ($signers=$webhook_zapsing['signers'])){
            if(is_array($signers)){
                foreach ($signers as $k => $signer) {
                    $nome = isset($signer['name']) ? $signer['name'] : '';
                    $status = isset($signer['status']) ? $signer['status'] : '';
                    // $nome_doc = isset($signer['name']) ? $signer['name'] : '';
                    // $email = isset($signering['email']) ? $signering['email'] : $email;
                    $email = isset($signer['email']) ? $signer['email'] : '';
                    $link = isset($signer['sign_url']) ? $signer['sign_url'] : '';
                    $mens = str_replace('{nome}',$nome,$temm);
                    $mens = str_replace('{nome_doc}',$nome_doc,$mens);
                    $mens = str_replace('{link}',$link,$mens);
                    $mens = str_replace('{app}',$app,$mens);
                    $ret['signer'][$k]['name'] = $nome;
                    $ret['signer'][$k]['email'] = $email;
                    $ret['signer'][$k]['nome_doc'] = $nome_doc;
                    $ret['signer'][$k]['link'] = $link;
                    $dialog_id = '679a438a9d7c8affe47e29b5';
                    if($k==0){
                        $telefonezap = $zgc->get_telefonezap_by_id_matricula($id_matricula);
                        $conf_link_zap = ['telefonezap'=>$telefonezap,'text'=>$mens,'gravar_resposta'=>false,'dialog_id'=>$dialog_id];
                    }else{
                        $conf_link_zap = ['email'=>$email,'text'=>$mens,'tab'=>'usuarios_sistemas','gravar_resposta'=>false,'dialog_id'=>$dialog_id];
                    }
                    if($status=='signed'){
                        $ret['signer'][$k]['status'] = $status;
                    }else{
                        $ret['signer'][$k]['criar_chat'] = $zgc->criar_chat($conf_link_zap);
                    }
                }
            }

        }
        //Registrar um log
        Log::info('enviar_link_assinatura para o zapguru:', $ret);
        return $ret;
    }

}
