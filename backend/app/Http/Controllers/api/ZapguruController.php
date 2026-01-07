<?php

namespace App\Http\Controllers;

use App\Services\Qlib;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ZapguruController extends Controller
{

    public $url;
    public $origem_padrao;
	function __construct(){
        global $tab15,$tab88;
		$this->credenciais();
        $tab15 = 'clientes';
        $tab88 = 'capta_lead';
        // $this->origem_padrao = (new RdstationController)->origem_padrao;
	}
    /**
     * Retorna o telefonezap de um aluno como o token da proposta
     * @param string $token
     * @uso $telefonezap = (new ZapguruController)->get_telefonezap_by_token_proposta($token);
     */
    public function get_telefonezap_by_token_proposta($token=null)
    {
        $ret = null;
        $id_cliente = Qlib::buscaValorDb0('matriculas','token',$token,'id_cliente');
        if($id_cliente){
            $ret = Qlib::buscaValorDb0('clientes','id',$id_cliente,'telefonezap');
        }
        return $ret;
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     * $requet = ['telefonezap'=>'',]
     */
    public function store(Request $request)
    {
        $d = $request->all();
        return $this->criar_chat($d);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }


	function credenciais(){

		$this->url = 'https://s4.chatguru.app/api/v1?key=FQXSYNB8GPSPALZ3MIC5O618HDP0OVUBRFCZ2LAZ4XCLVA44ZA8FPOJM8UG08IJ9&account_id=5f36da757e786f40069aa881&';

	}

	public function phone_id(){
		$ret = '628d294cc5ef6cb21b445e47';
		return $ret;
	}
    /**
     * returna o link do chat na query string
     */
    public function link_chat($zp){
        if(is_string($zp)){
            if(json_validate($zp)){
                $zp = Qlib::lib_json_array($zp);
            }
        }
        $link = isset($zp['link_chat']) ? $zp['link_chat'] : false;
        return $link;
    }

	public function webhook($config=false){
		$ret = false;
		$json = file_get_contents('php://input');


		$arr_json = Qlib::lib_json_array($json);
        $event = isset($arr_json['origem']) ? $arr_json['origem'] : '';
        $telefonezap = $this->get_telefone($arr_json);
        $nome = $this->get_nome($arr_json);
        $email = $this->get_email($arr_json);
        $id_cliente = $this->get_client_id($arr_json);
        Log::info('Webhook zapguru '.$event.':', $arr_json);
        $ret['exec'] = false;
        if(isset($arr_json['origem'])){

			if($arr_json['origem']=='envia_campos' || $arr_json['origem']=='disparo_crm'){

				$ret['atualizaCliente'] = $this->atualizaCliente($json);//Atualiza o cadastro do clientes com json e retorma campos

				$ret['json'] = $arr_json;

				$arquivo = fopen(dirname(__FILE__).'/teste_webhook.txt','a');

				fwrite($arquivo, $json.',');

				//Fechamos o arquivo após escrever nele

				fclose($arquivo);

			}elseif($arr_json['origem']=='respondeu_nome' || $arr_json['origem']=='respondeu_email'  || $arr_json['origem']=='add_lead'){

                $ret['atendimento'] = $this->salvarCaptaLead($arr_json);
                // dd( $ret);

				$arquivo = fopen(dirname(__FILE__).'/atendimento.txt','a');

				fwrite($arquivo, $json.',');

				//Fechamos o arquivo após escrever nele

				fclose($arquivo);

			}elseif($event == 'update_lead' && $telefonezap){
                $nome = $this->get_nome($arr_json,2);
                //Atualiza o cliente e lead de acornto com o retorno
                $dadd = [
                    'zapguru' => $json,
                ];
                $add_cliente = false; //para adicionar um clientes na tabela de clientes
                if($id_cliente && !empty($id_cliente)){
                    $where = "WHERE id='$id_cliente'";
                }else{
                    $where = "WHERE telefonezap='$telefonezap'";
                    //checar para ver se o cadastro está com o esse telefone caso não encontrar use a consulta pelo nome
                    if($add_cliente){
                        if(Qlib::totalReg('clientes',$where)==0){
                            $where = "WHERE Nome='$nome'";
                        }
                    }
                }
                if($telefonezap){
                    //Casa ja tenha um telefonezap verificar se o lead ja virou cliente
                    $where = "WHERE telefonezap='$telefonezap'";
                    //checar para ver se o cadastro está com o esse telefone caso não encontrar use a consulta pelo nome
                    if(Qlib::totalReg('clientes',$where)>0){
                        $cl = Qlib::update_tab('clientes',$dadd,$where,'edit_all');
                        $ret['clientes'] = $cl;
                        // dd($ret,$where,$add_cliente,$telefonezap,$dadd);
                        return $ret;
                    }
                }
                if($add_cliente){
                    //adiciona o cliente na tabela de clientes
                    $cl = Qlib::update_tab('clientes',$dadd,$where);
                    $ret['clientes'] = $cl;
                }
                //verificar se no nome tem o ID do registro no nesse caso o nome seria: Vinícius Rodrigues |36098
                $a_nome=explode('-',$nome);
                if(isset($a_nome[1])){
                    $arr_cli = explode('|',trim($a_nome[1]));
                    $id_cliente = isset($arr_cli[0]) ? $arr_cli[0] : null;
                    if(!is_null($id_cliente)){
                        $id_cliente = trim($id_cliente);
                    }
                }else{
                    $id_cliente = isset($a_nome[1]) ? $a_nome[1] : null;
                }
                $whereLead = "WHERE id='$id_cliente'";
                $whereLead2 = "WHERE nome='$nome'";
                $tabLead = 'capta_lead';
                if(Qlib::totalReg($tabLead,$whereLead)>0){
                    $ddlead = [
                        'zapguru' => $json,
                    ];
                }elseif(Qlib::totalReg($tabLead,$whereLead2)>0){
                    $ddlead = [
                        'zapguru' => $json,
                    ];
                }else{
                    $ddlead = [
                        'nome' => $nome,
                        'email' => $email,
                        'celular' => $telefonezap,
                        'zapguru' => $json,
                        'token' => uniqid(),
                        'tag_origem' => 'zapguru',
                        'excluido' => 'n',
                        'deletado' => 'n',
                        'atualizado' => Qlib::dataLocalDb(),
                        // 'EscolhaDoc' => 'CPF',
                    ];

                }
                $lead = Qlib::update_tab($tabLead,$ddlead,$whereLead);
                if(isset($lead['exec']) && !$lead['exec'] && $telefonezap){
                    $whereLead = "WHERE celular='$telefonezap'";
                    $lead = Qlib::update_tab($tabLead,$ddlead,$whereLead);
                }
                $ret['capt_lead'] = $lead;
                //criar uma anotação o o link do chatguru
                if(isset($lead['idCad'])){
                    $link_chat = $this->link_chat($json);
                    if($link_chat){
                        $text = 'Link do <a target="_BLANK" href="'.$link_chat.'">Whatsapp</a>';
                        //verificar se pode enviar uma anotação
                        // $dlead = Qlib::dados_tab($tabLead,['where' => "WHERE id = '".$lead['idCad']."'"]);
                        // return $dlead;
                        $ret['anota_rd'] = (new RdstationController )->anota_por_cliente($lead['idCad'],$text,$tabLead);
                        //veririca se ja tem uma negociação para esse cliente
                        // $ret['adiciona_RD'] = $this->add_rd_negociacao($arr_json,$lead['idCad'],$link_chat);

                    }
                }
			}elseif($event == 'deal_create_rd' && $telefonezap){
                //Atualiza o cliente e lead de acornto com o retorno
                $dadd = [
                    'zapguru' => $json,
                ];
                // dd($id_cliente);
                $add_cliente = false; //para adicionar um clientes na tabela de clientes
                if($id_cliente && !empty($id_cliente)){
                    $where = "WHERE id='$id_cliente'";
                }else{
                    $where = "WHERE telefonezap='$telefonezap'";
                    //checar para ver se o cadastro está com o esse telefone caso não encontrar use a consulta pelo nome
                    if($add_cliente){
                        if(Qlib::totalReg('clientes',$where)==0){
                            $where = "WHERE Nome='$nome'";
                        }
                    }
                }
                if($add_cliente){
                    //adiciona o cliente na tabela de clientes
                    $cl = Qlib::update_tab('clientes',$dadd,$where);
                    $ret['clientes'] = $cl;
                }
                $whereLead = "WHERE nome='$nome'";
                $tabLead = 'capta_lead';
                if(Qlib::totalReg($tabLead,$whereLead)>0){
                    $ddlead = [
                        'zapguru' => $json,
                    ];
                }else{
                    $ddlead = [
                        'nome' => $nome,
                        'email' => $email,
                        'celular' => $telefonezap,
                        'zapguru' => $json,
                        'token' => uniqid(),
                        'tag_origem' => 'zapguru',
                        'excluido' => 'n',
                        'deletado' => 'n',
                        'atualizado' => Qlib::dataLocalDb(),
                        // 'EscolhaDoc' => 'CPF',
                    ];

                }
                $lead = Qlib::update_tab($tabLead,$ddlead,$whereLead);
                if(isset($lead['exec']) && !$lead['exec'] && $telefonezap){
                    $whereLead = "WHERE celular='$telefonezap'";
                    $lead = Qlib::update_tab($tabLead,$ddlead,$whereLead);
                }
                $ret['capt_lead'] = $lead;
                //criar uma anotação o o link do chatguru
                if(isset($lead['idCad'])){
                    $link_chat = $this->link_chat($json);
                    if($link_chat){
                        $text = 'Link do <a target="_BLANK" href="'.$link_chat.'">Whatsapp</a>';
                        //verificar se pode enviar uma anotação
                        // $dlead = Qlib::dados_tab($tabLead,['where' => "WHERE id = '".$lead['idCad']."'"]);
                        // return $dlead;
                        // $ret['anota_rd'] = (new RdstationController )->anota_por_cliente($lead['idCad'],$text,$tabLead);
                        $email_res = $this->get_responsavel_email($arr_json);
                        $user_rd = null;
                        if($email_res){
                            $duser = Qlib::get_user_data("WHERE email='$email_res'");
                            if(isset($duser['config']) && !empty($duser['config'])){
                                $arr_con = Qlib::lib_json_array($duser['config']);
                                $user_rd = isset($arr_con['id_rd']) ? $arr_con['id_rd'] : '';
                            }
                        }
                        $ret['adiciona_RD'] = $this->add_rd_negociacao($arr_json,$lead['idCad'],$link_chat,$user_rd);
                        //veririca se ja tem uma negociação para esse cliente
                    }
                }
			}else{
                $ret['req_json'] = $arr_json;
            }
		}



		/*$arquivo = fopen(dirname(__FILE__).'/atendimento.txt','a');

				fwrite($arquivo, $json.',');

				//Fechamos o arquivo após escrever nele

				fclose($arquivo);*/

				// dump($ret);

		return $ret;

	}
    public function add_rd_negociacao($_zapguru,$id_lead,$link_chat,$user_id=null){
        $nome = $this->get_nome($_zapguru);
        $email = $this->get_email($_zapguru);
        $telefone = $this->get_telefone($_zapguru);
        $id_campo_origem = '67a4b19e1688c9002139e3c5';
        $id_campo_user_id = $user_id?$user_id: '678947e873759800146e7e00';
        $id_campo_funil = '67976140c4eb85001b3d3ec8';
        $tag_origem = $this->origem_padrao;
        $query_rd = [
            "deal" => [
                "deal_stage_id" =>$id_campo_funil,
                "user_id" => $id_campo_user_id,
                "name" => $nome,
                "deal_custom_fields" => [
                    [
                        "custom_field_id"=> $id_campo_origem,
                        "value"=> $tag_origem,
                    ],
                ]
            ],
            "contacts" => [
                [
                "emails" => [
                    [
                        "email" => $email
                    ]
                ],
                "name" => $nome,
                "phones" => [
                        [
                        "phone" => $telefone,
                        "type" => "cellphone"
                        ]
                    ]
                ]
            ]
        ];
        // return $query_rd;
        //enviar post para o rd
        $rdc = new RdstationController;
        $ret = $rdc->post('deals',$query_rd);
        $id_negocio = isset($ret['data']['id']) ? $ret['data']['id'] : null;
        if($id_negocio!==null && $id_lead){
            //adquirir os dados do cliente da negociacao
            $dados_contato = $rdc->get_contact($id_negocio);
            $id_contato = isset($dados_contato['data']['contacts'][0]['id']) ? $dados_contato['data']['contacts'][0]['id'] : null;
            $rd = [
                'document'=>$ret['data'],
            ];
            $ret['update'] = Qlib::update_tab('capta_lead',[
                'rdstation' => $id_contato,
                'rd_ultimo_negocio' => Qlib::lib_array_json($rd),
                'atualizado' => Qlib::dataLocalDb(),
            ],"WHERE id = '$id_lead'");
            // ],"WHERE celular = '$telefone'");
            $text = 'Link do <a target="_BLANK" href="'.$link_chat.'">Whatsapp</a>';

            $ret['anota_link'] = $rdc->criar_anotacao([
                'text' => $text,
                'deal_id' => $rdc->get_deal_id($rd),
                'user_id' => $rdc->get_user_id($rd),
            ]);
        }
        return $ret;
    }
	public function salvarCaptaLead($config=false){

		//Salvar o cliente recebido da webhook

		$ret = false;

		// if(isset($config['responsavel_email']) && !empty($config['responsavel_email'])){

		// 	$dadosCon = buscaValoresDb_SERVER("SELECT * FROM usuarios_sistemas WHERE trim(email)='".trim($config['responsavel_email'])."' AND ".compleDelete());

		// }else{

			$dadosCon = false;

		// }
		if(isset($config['origem']) && isset($config['celular']) && isset($config['texto_mensagem']) && !empty($config['texto_mensagem']) &&($config['origem']=='respondeu_nome' || $config['origem']=='respondeu_email')){

			$arr_or = explode('_',$config['origem']);

			if(!isset($arr_or[1])){

				return $ret;

			}

			$dadosForm = [

				'celular'=>$config['celular'],

				'token'=>uniqid(),

				'zapguru'=>Qlib::lib_array_json($config),

				$arr_or[1]=>$config['texto_mensagem'],

				'tag_origem'=>'zapguru',

				'conf'=>'s',

			];

			if(isset($config['nome']) && !empty($config['nome'])){

				$dadosForm['nome'] = $config['nome'];

			}

			if(isset($dadosCon[0]['id']) && $dadosCon[0]['id']>0){

				$dadosForm['seguido_por'] = $dadosCon[0]['id'];

			}

			$comple = " AND ".Qlib::compleDelete();

			$cond_valid = "WHERE celular = '".$config['celular']."' $comple";

			$type_alt = 1;

			$tabUser = $GLOBALS['tab88'];

			// $config2 = array(

			// 			'tab'=>$tabUser,

			// 			'valida'=>true,

			// 			'condicao_validar'=>$cond_valid,

			// 			'sqlAux'=>false,

			// 			'ac'=>'cad',

			// 			'type_alt'=>$type_alt,

			// 			'dadosForm' => $dadosForm

			// );

			//if(isAdmin(1)){

				 //lib_print($config2);exit;

			//}

			$ret = Qlib::update_tab($GLOBALS['tab88'],$dadosForm,$cond_valid);//Declado em Lib/Qlibrary.php

			// lib_print($ret);exit;

			// $ret = json_decode($ret,true);

		}

		if(isset($config['origem']) && isset($config['celular']) &&($config['origem']=='respondeu_nome' || $config['origem']=='add_lead')){

			$arr_or = explode('_',$config['origem']);

			if(!isset($arr_or[1])){

				return $ret;

			}

			$dadosForm = [

				'celular'=>$config['celular'],

				'token'=>uniqid(),

				'zapguru'=>Qlib::lib_array_json($config),

				$arr_or[1]=>@$config['texto_mensagem'],

				'tag_origem'=>'zapguru',

				'tag'=>@$config['tags'],

				'conf'=>'s',

			];

			if(isset($config['nome']) && !empty($config['nome'])){

				$dadosForm['nome'] = $config['nome'];

			}

			if(isset($dadosCon[0]['id']) && $dadosCon[0]['id']>0){

				$dadosForm['seguido_por'] = $dadosCon[0]['id'];

			}

			if(isset($config['campos_personalizados']['Nome']) && !empty($config['campos_personalizados']['Nome'])){

				$dadosForm['nome'] = $config['campos_personalizados']['Nome'];

			}

			if(isset($config['campos_personalizados']['Email']) && !empty($config['campos_personalizados']['Email'])){

				$dadosForm['email'] = $config['campos_personalizados']['Email'];

			}

			$comple = " AND ".Qlib::compleDelete();

			$cond_valid = "WHERE celular = '".$config['celular']."' $comple";

			$type_alt = 1;

			$tabUser = $GLOBALS['tab88'];

			$config2 = array(

						'tab'=>$tabUser,

						'valida'=>true,

						'condicao_validar'=>$cond_valid,

						'sqlAux'=>false,

						'ac'=>'cad',

						'type_alt'=>$type_alt,

						'dadosForm' => $dadosForm

			);

			//return $config2;

			//if(isAdmin(1)){

				//  lib_print($config2);exit;

			//}
			$ret = Qlib::update_tab($tabUser,$dadosForm,$cond_valid);//Declado em Lib/Qlibrary.php
			$telefonezap = $config2['dadosForm']['celular'];
			$verifica_cadCliente = Qlib::dados_tab($GLOBALS['tab15'],[ 'campos'=> '*', 'where' => "WHERE telefonezap='".$telefonezap."'"]);
			//lib_print($verifica_cadCliente);
			if(@$verifica_cadCliente['telefonezap']){
				$ret['verifica_cadCliente'] = $verifica_cadCliente;
				$ret['salvarCadCli'] = (new ClientesController)->convert_LeadCliente(['id'=>$telefonezap,'campo_bus'=>'celular','type'=>'lc','cond_valid'=>"WHERE telefonezap='".$verifica_cadCliente['telefonezap']."'"]);
                // dump($ret);
			}
			$ret = Qlib::lib_array_json($ret);


		}

		return $ret;

	}
    /**
     * returna o id do chat na query string
     * usando um campo persolanizado
     */

    public function get_client_id($zp){
        if(is_string($zp)){
            if(json_validate($zp)){
                $zp = Qlib::lib_json_array($zp);
            }
        }
        $link = isset($zp['campos_personalizados']['ID_do_cliente']) ? $zp['campos_personalizados']['ID_do_cliente'] : null;
        return $link;
    }
    /**
     * returna o Email do chat na query string
     * usando um campo persolanizado
     */

    public function get_email($zp){
        if(is_string($zp)){
            if(json_validate($zp)){
                $zp = Qlib::lib_json_array($zp);
            }
        }
        $email = isset($zp['campos_personalizados']['Email']) ? $zp['campos_personalizados']['Email'] : null;
        return $email;
    }
    /**
     * returna o Email do chat na query string
     * usando um campo persolanizado
     */

    public function get_responsavel_email($zp){
        if(is_string($zp)){
            if(json_validate($zp)){
                $zp = Qlib::lib_json_array($zp);
            }
        }
        $email = isset($zp['responsavel_email']) ? $zp['responsavel_email'] : '';
        return $email;
    }
    /**
     * returna o nome do chat na query string
     * usando um campo persolanizado
     */

    public function get_telefone($zp){
        if(is_string($zp)){
            if(json_validate($zp)){
                $zp = Qlib::lib_json_array($zp);
            }
        }
        $celular = isset($zp['celular']) ? $zp['celular'] : '';
        return $celular;
    }
    /**
     * returna o nome do chat na query string
     * usando um campo persolanizado
     */

    public function get_nome($zp,$type=1){
        if(is_string($zp)){
            if(json_validate($zp)){
                $zp = Qlib::lib_json_array($zp);
            }
        }
        if($type==1){
            //nesse tipo a preferencia é buscar o nome pelo valor no campos personalizado
            $nome = isset($zp['campos_personalizados']['Nome']) ? $zp['campos_personalizados']['Nome'] : '';
            if(empty($nome)){
                $nome = isset($zp['nome']) ? $zp['nome'] : null;
            }
            $nome = trim($nome);
        }elseif($type==2){
            $nome = isset($zp['nome']) ? $zp['nome'] : null;
            if(empty($nome)){
                $nome = isset($zp['campos_personalizados']['Nome']) ? $zp['campos_personalizados']['Nome'] : '';
            }
            $nome = trim($nome);
        }
        return $nome;
    }
    /**
     * metodo para disparar postagem para API do zapguru
     * @param string $chat_number = o numero do chat
     * @param string $action = a acão que será realizada
     * @param string $comple_url = continuação da url
     * @return array $ret o resulo da requesição
     * @uso (new ZapguruController)->post($chat_number,$action,$comple_url='');
     */
    public function post($chat_number,$action,$comple_url=''){
        $phone_id 		= $this->phone_id();
		// $dialog_id 		= isset($config['dialog_id'])?$config['dialog_id']:'';
        $url = $this->url.'action='.$action.'&chat_number='.$chat_number.'&phone_id='.$phone_id.$comple_url;
		$ret['url'] = $url;
        $response = Http::accept('application/json')->post($url);
		$ret['response'] = Qlib::lib_json_array($response,true);
        return $ret;
    }
    /**
     * Verifica se um chat existe e retorna um disparo webhook com o acionamento de um dialo de id
     */
    public function verifica_chat($telefone_zap){
        $note = 'Verificação a existencia do chat';
        $comple_sql = '&dialog_id='.$note;
        $ret = $this->post('dialog_execute',$comple_sql);
        return $ret;
    }
    /**
     * Metodo para criar um chat zapguru com o Email do cliente ou telefone
     * @param array estrutura do array $config=['telefonezap'=>'553299999999','dialog_id'=>'opcional'];
     * uso $ret = (new ZapguruController)->criar_chat(['email'=>'ger.maisaqui1@gmail.com','text'=>'Mensagem de teste']);
     * uso $ret = (new ZapguruController)->criar_chat(['telefonezap'=>'5532999999','text'=>'Mensagem de teste']);
     */
	public function criar_chat($config=false){

		//Exemplo de uso

		/*

		$zg = new ZapguruController;

		$ret = $zg->criar_chat(array('telefonezap'=>'5532984741602'));

		*/

		$ret['exec'] = false;
        $cel = isset($config['telefonezap']) ? $config['telefonezap'] : false;
        $tab = isset($config['tab']) ? $config['tab'] : $GLOBALS['tab15'];
        $user_id = isset($config['user_id']) ? $config['user_id'] : '';
        $cadastrado = isset($config['cadastrados']) ? $config['cadastrados'] : true; // permite criar chat de clientes cadastrados ou não
        // $text 		 	= isset($config['text'])?$config['text'] 	:'Olá *{nome}* como podemos ajudá-lo';
        $text 		 	= isset($config['text'])?$config['text'] 	:' ';
        if(!$cel){
            $cel = isset($config['Celular']) ? $config['Celular'] : false;
        }
		if($cel){
            if($tab=='capta_lead'){
                $comSc = " AND celular='".$cel."'";
            }else{
                $comSc = " AND telefonezap='".$cel."'";
            }
		}else{
            //verificar se foi informado um email para conseguir o telefonezap pelo email
            $email = isset($config['email']) ? $config['email'] : false;
            if($email){
                if($tab=='capta_lead'){
                    $campo_bus = 'email';
                    $campo_enc = 'celular';
                    $cel = Qlib::buscaValorDb0($tab,$campo_bus,$email,$campo_enc," AND ".Qlib::compleDelete());
                }elseif($tab == 'usuarios_sistemas'){
                    $campo_bus = 'email';
                    $campo_enc = 'telefonezap';
                    $comSc = "WHERE $campo_bus='$email'";
                }else{
                    $campo_bus = 'Email';
                    $campo_enc = 'telefonezap';
                    $cel = Qlib::buscaValorDb0($tab,$campo_bus,$email,$campo_enc," AND ".Qlib::compleDelete());
                }
                // dd($cel);
                if($tab != 'usuarios_sistemas'){
                    if($cel){
                        $comSc = " AND $campo_enc='".$cel."'";
                    }else{
                        $ret['mens'] = Qlib::formatMensagemInfo('Telefone não informado não encontrado!','danger');
                        $ret['color'] = 'danger';
                        return $ret;
                    }
                }
            }else{
           		$ret['mens'] = Qlib::formatMensagemInfo('Email ou telefone não informado não encontrado!','danger');
                $ret['color'] = 'danger';
				return $ret;

            }
		}
        if($comSc){
            if($tab=='usuarios_sistemas'){
                $dadosCli = Qlib::get_user_data($comSc);
            }else{
                $dadosCli = Qlib::dados_tab($tab,['campos'=>'*','where'=>"WHERE ".Qlib::compleDelete()."$comSc ORDER BY id DESC"]);
            }
            // return $dadosCli;
			if(!$dadosCli && $cadastrado){
				$ret['mens'] = Qlib::formatMensagemInfo('Cliente com telefone '.$cel.' não encontrado!','danger');
                $ret['color'] = 'danger';
				return $ret;
			}
            $id_cliente = isset($dadosCli[0]['id']) ? $dadosCli[0]['id'] : false;
            // dump($dadosCli);
            if($cadastrado){
                if($tab=='capta_lead'){
                    $Celular 	 	= str_replace('(','',$dadosCli[0]['celular']);
                    $nome 		 	= isset($dadosCli[0]['nome'])?$dadosCli[0]['nome'] 	:false;
                    $sobrenome = '';
                    $chat_number 	= $dadosCli[0]['celular'];
                }else{
                    $nome 		 	= isset($dadosCli[0]['Nome'])?$dadosCli[0]['Nome'] 	:false;
                    $pais = !empty($dadosCli[0]['pais'])?$dadosCli[0]['pais']:'Brasil';
                    $codi_pais = false;
                    if($pais=='Brasil' && !isset($config['telefonezap'])){

                        $codi_pais = '55';

                    }
                    $sobrenome 		= isset($dadosCli[0]['sobrenome']) ? $dadosCli[0]['sobrenome'] 	:false;
                    if(isset($dadosCli[0]['telefonezap']) && !empty($dadosCli[0]['telefonezap'])){
                        $chat_number 	= $dadosCli[0]['telefonezap'];
                    }else{
                        if($tab=='usuarios_sistemas'){
                            $Celular 	 	= str_replace('(','',$dadosCli['celular']);
                            $nome 		 	= isset($dadosCli['nome'])?$dadosCli['nome'] 	:false;
                        }else{
                            $Celular 	 	= str_replace('(','',$dadosCli[0]['Celular']);
                        }
                        $Celular 		= str_replace(')','',$Celular);
                        $Celular 		= str_replace('-','',$Celular);
                        $chat_number 	= $codi_pais.$Celular;
                    }
                }
                $name  = urlencode($nome.' '.$sobrenome);
                $ret['dadosCli'] = $dadosCli;
			}else{
                $name = 'Senhor(a)';
                $chat_number 	= $cel;
            }
            $nome_=$nome;
            $nom = explode('+',$nome_);
            if(isset($nom[0]) && !empty($nom[0])){
                $nome_=$nome;
            }
            $text  = str_replace('{nome}',$nome_,$text);
            $text  = urlencode($text);

			$phone_id 		= isset($config['phone_id'])?$config['phone_id']:$this->phone_id();
			//Executar um dialogo opcional
			$dialog_id 		= isset($config['dialog_id'])?$config['dialog_id']:'';

			$action 		= 'chat_add';

			$ret['config'] = $config;
            //adiciona o id no nome
            if($tab=='usuarios_sistemas'){
                if(isset($dadosCli['id']) && ($id_cliente=$dadosCli['id'])){
                    $name .= ' - '.$id_cliente.' | CRM';
                }
            }else{
                if(isset($dadosCli[0]['id']) && ($id_cliente=$dadosCli[0]['id'])){
                    $name .= ' - '.$id_cliente.' | CRM';
                }
            }
            // return $nome;
			$url = $this->url.'action='.$action.'&phone_id='.$phone_id.'&name='.$name.'&text='.$text.'&chat_number='.$chat_number;
			// return $url;
            if($dialog_id){
				$url .= '&dialog_id='.$dialog_id.'';
			}
			if($user_id){
				$url .= '&user_id='.$user_id.'';
			}
			$ret['url'] = $url;
            // return $url;
            // return $ret;
            $response = Http::accept('application/json')->post($url);

			$ret['response'] = Qlib::lib_json_array($response,true);

			if(isset($ret['response']['code']) && $ret['response']['code']==201){
				$ret['exec'] = true;
                //gravar o status no usuario encotrado no CRM do Aero
                $ret['id_cliente'] = $id_cliente;
                //Controlar a gravação da respota ao usar essa função para não apagar o que ja está gravado
                $gravar_resposta = isset($config['gravar_resposta']) ? $config['gravar_resposta'] : true;
                if($gravar_resposta && $cadastrado && $id_cliente){
                    $ret['salvar'] = DB::table($GLOBALS['tab15'])->where('id',$id_cliente)->update(['zapguru' => $response]);
                }
			}

			if(isset($ret['response']['description'])&&isset($ret['response']['result'])){

				$css = 'danger';

				if($ret['response']['result']=='success'){

					$css = $ret['response']['result'];

				}

				$ret['mens'] = Qlib::formatMensagem0($ret['response']['description'],$css);

			}

		}

		return $ret;

	}

    /**
     * retorna o link de um chat aparti de uma respota webhook zapguru valida
     * @param array $config
     */
    public function get_list_chat($config){
        if(Qlib::isJson($config)){
            $arr_post = Qlib::lib_json_array($config);
        }elseif(is_array($config)){
            $arr_post = $config;
        }else{
            $arr_post = array();
        }
        return $arr_post['list_chat'];
    }

	function enviar_mensagem($config=false){

		//Exemplo de uso

		/*

		$zg = new ZapController;

		$ret = $zg->enviar_mensagem([
            'celular_completo'=>'553291648202',
            'nome'=>'Queta',
            'text'=>'Olá *{nome}* como podemos ajudá-lo teste ',
            'dialog_id'=>'',
        ]);

		lib_print($ret);

		*/

		$ret['exec'] = false;

		if(isset($config['celular_completo'])){

			/*

			$pais = !empty($dadosCli[0]['pais'])?$dadosCli[0]['pais']:'Brasil';

			$codi_pais = false;

			if($pais=='Brasil'){

				$codi_pais = '55';

			}

			$ret['dadosCli'] = $dadosCli;

			*/

			$Celular 	 	= str_replace('(','',$config['celular_completo']);

			$Celular 		= str_replace('+','',$Celular);

			$Celular 		= str_replace(')','',$Celular);

			$Celular 		= str_replace('-','',$Celular);

			$nome 		 	= isset($config['nome'])?$config['nome'] 	:false; //caso o chat não exista irá criar um com este nome

			$sobrenome 		= isset($config['sobrenome'])?$config['sobrenome'] 	:false;

			$name  = urlencode($nome.' '.$sobrenome);

			$text 		 	= isset($config['text'])?$config['text'] 	:'Olá *'.$nome.'* como podemos ajudá-lo';

			$text  = str_replace('{nome}',$nome,$text);

			$text  = urlencode($text);

			$chat_number 	= $Celular;

			$phone_id 		= isset($config['phone_id'])?$config['phone_id']:'628d294cc5ef6cb21b445e47';

			$dialog_id 		= isset($config['dialog_id'])?$config['dialog_id'] 	:false;

			$action 		= 'message_send';

			$ret['config'] = $config;

			$url = $this->url.'action='.$action.'&phone_id='.$phone_id.'&name='.$name.'&text='.$text.'&chat_number='.$chat_number.'&dialog_id='.$dialog_id.'';

			$curl 		 	= curl_init();


			curl_setopt_array($curl, array(

			  CURLOPT_URL => $url,

			  CURLOPT_RETURNTRANSFER => true,

			  CURLOPT_ENCODING => '',

			  CURLOPT_MAXREDIRS => 10,

			  CURLOPT_TIMEOUT => 0,

			  CURLOPT_FOLLOWLOCATION => true,

			  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,

			  CURLOPT_CUSTOMREQUEST => 'POST',

			));



			$response = curl_exec($curl);



			curl_close($curl);

			$ret['response'] = Qlib::lib_json_array($response,true);
			$ret['url'] = $url;
			/*if(isset($ret['response']['code']) && $ret['response']['code'] != 201){

				$celular_completo = '55'.str_replace('(32)9','(32)',$config['celular_completo']);

				$config['celular_completo'] = $celular_completo;

				$ret['response'] = $this->enviar_mensagem($config);

			}else*/if(isset($ret['response']['code'])&&$ret['response']['code']==201){

				$ret['exec'] = true;

			}

			if(isset($ret['response']['description'])&&isset($ret['response']['result'])){

				$css = 'danger';

				if($ret['response']['result']=='success'){

					$css = $ret['response']['result'];

				}

				$ret['mens'] = Qlib::formatMensagem0($ret['response']['description'],$css);

			}

		}

		return $ret;

	}
	/**
	 * Metodo para o envio de mensagem para o whatsapp do cliente com a api do zapguru usando o token de um orçamento do cliente
	 * @param string $tk = token da matricula, string $text = a Mensagem a ser enviada
	 * @return array $ret contendo callback da api do zapguru.
	 * @uso $ret = (new zapguru)->envia_zap_orcamento($tk,$text);
	 */
	public function envia_zap_orcamento($tk,$text,$periodo=false){
        // $zg = new zapguru;
        $dm = cursos::dadosMatricula($tk);
        $ret['exec'] = false;
		$ret['dm'] = $dm;
		// lib_print( $celular_completo);
		// dd( $dm);
		$link_pagina = '';
		if($periodo){
			$d_periodo = (new Orcamentos)->get_periodo_array($tk,'periodo',$periodo);
			$token_periodo = isset($d_periodo['token']) ?$d_periodo['token']:'';
			$link_pagina = cursos::link_assinatura_periodo($tk,$token_periodo);
		}
		//salvar o mensagem atual no banco para futuro uso gravo no banco config com o campo: mensagem_zap_periodo
		$ret['s_mzap'] = update_option('mensagem_zap_periodo',$text);
		$text = str_replace('{periodo}',$periodo,$text);
		$text = str_replace('{link_pagina}',$link_pagina,$text);
		if($dm && $text){
			$dm = $dm[0];
			$celular_completo = isset($dm['telefonezap']) ? $dm['telefonezap'] : false;
			$ret = $this->enviar_mensagem([
				'celular_completo'=>$celular_completo ? $celular_completo : false,
				'nome'=>'Queta',
				'text'=>$text ? $text : false,
				'dialog_id'=>'',
			]);
		}
        return $ret;
    }
	public function dialog_execute($config=false){

		//Exemplo de uso

		/*

		$zg = new zapguru;

		$ret = (new zapguru)->dialog_execute(['telefonezap'=>'5532984741608','dialog_id'=>'']);

		*/

		$ret['exec'] = false;

		$compleSql = isset($config['compleSql']) ? $config['compleSql'] : false;


		if(isset($config['telefonezap'])){
			$compleSql .= " AND telefonezap='".$config['telefonezap']."'";
		}elseif(isset($config['id'])){
			$compleSql .= " AND id = '".$config['id']."'";
		}else{
			$compleSql = " AND Celular='".$config['celular_completo']."'";
		}
		if($compleSql){

			$dadosCli = dados_tab($GLOBALS['tab15'],'*',"WHERE ".compleDelete()."$compleSql");

			if(!$dadosCli){

				$ret['mens'] = formatMensagem('Cliente não encontrado!','danger');

				return $ret;

			}

			$pais = !empty($dadosCli[0]['pais'])?$dadosCli[0]['pais']:'Brasil';

			$codi_pais = false;

			if($pais=='Brasil' && !isset($config['telefonezap'])){

				$codi_pais = '55';

			}

			$ret['dadosCli'] = $dadosCli;
			if($dadosCli[0]['Celular']){

				$Celular 	 	= str_replace('(','',$dadosCli[0]['Celular']);

				$Celular 		= str_replace(')','',$Celular);

				$Celular 		= str_replace('-','',$Celular);
			}else{
				$celular = '';
			}

			$nome 		 	= isset($dadosCli[0]['Nome'])?$dadosCli[0]['Nome'] 	:false;

			$sobrenome 		= isset($dadosCli[0]['sobrenome']) ? $dadosCli[0]['sobrenome'] 	:false;
			$name  = urlencode($nome.' '.$sobrenome);

			$text 		 	= isset($config['text'])?$config['text'] 	:'Olá *'.$nome.'* como podemos ajudá-lo';

			$text  = str_replace('{nome}',$nome,$text);

			$text  = urlencode($text);

			$chat_number 	= trim($codi_pais).trim($Celular);

			$chat_number = str_replace(' ','',$chat_number);

			$phone_id 		= isset($config['phone_id'])?$config['phone_id']:$this->phone_id();

			$dialog_id 		= isset($config['dialog_id'])?$config['dialog_id']:false;
			if(!$dialog_id){
				$dialog_id = '626ff0553408059edfb29110';
			}
			$action 		= 'dialog_execute';

			$ret['config'] = $config;
			if(empty($dadosCli[0]['telefonezap'])){
				if(!empty($dadosCli[0]['zapguru']) && !empty($dadosCli[0]['zapguru'])){
					$arr_zapguru = lib_json_array($dadosCli[0]['zapguru']);
					$chat_number = isset($arr_zapguru['celular'])?$arr_zapguru['celular'] : 0;
				}
			}else{
				$chat_number = $dadosCli[0]['telefonezap'];

			}
			if(!$chat_number){
				$ret['exec'] = false;
				$ret['mens'] = formatMensagem('Celular chat invário','danger',10000);
			}

			$url = $this->url.'action='.$action.'&phone_id='.$phone_id.'&name='.$name.'&chat_number='.$chat_number.'&dialog_id='.$dialog_id.'';

			// dd($url);
			if(isAdmin(1)){

				$ret['url'] = $url;

			}

			$curl 		 	= curl_init();



			curl_setopt_array($curl, array(

			  CURLOPT_URL => $url,

			  CURLOPT_RETURNTRANSFER => true,

			  CURLOPT_ENCODING => '',

			  CURLOPT_MAXREDIRS => 10,

			  CURLOPT_TIMEOUT => 0,

			  CURLOPT_FOLLOWLOCATION => true,

			  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,

			  CURLOPT_CUSTOMREQUEST => 'POST',

			));



			$response = curl_exec($curl);



			curl_close($curl);

			$ret['response'] = lib_json_array($response,true);

			if(isset($ret['response']['code'])&&$ret['response']['code']==200){

				$css = 'success';

				$ret['exec'] = true;

				$ret['mens'] = formatMensagem($ret['response']['dialog_execution_return'],$css);
				if(empty($dadosCli[0]['telefonezap']) && isset($config['celular_completo'])){
					$dadosCli = dados_tab($GLOBALS['tab15'],'zapguru',"WHERE Celular='".$config['celular_completo']."' $compleSql AND ".compleDelete());
				}else{
					if(isset($dadosCli[0]['id'])){
						$dadosCli = dados_tab($GLOBALS['tab15'],'zapguru',"WHERE id='".$dadosCli[0]['id']."' $compleSql AND ".compleDelete());
					}else{
						$dadosCli = dados_tab($GLOBALS['tab15'],'zapguru',"WHERE telefonezap='".$config['telefonezap']."' $compleSql AND ".compleDelete());
					}
				}

				if($dadosCli){

					$ret['celular_completo'] = isset($config['celular_completo']) ? $config['celular_completo']:false;

					$ret['zapguru'] = lib_json_array($dadosCli[0]['zapguru']);

				}

			}

			if(isset($ret['response']['description'])&&isset($ret['response']['result'])){

				$css = 'danger';

				if($ret['response']['result']=='success'){

					$css = $ret['response']['result'];

				}

				$ret['mens'] = formatMensagem($ret['response']['description'],$css);

			}

		}

		return $ret;

	}

	function verificaLinkGuru($config=false){

		//Exemplo de uso

		/*

		$zg = new zapguru;

		$ret = $zg->verificaLinkGuru(array('celular_completo'=>'(32)98474-8644'));

		*/

		$ret = false;

		$ret['zapguru'] = false;

		if(isset($config['celular_completo'])){

			$compleSql = isset($config['compleSql']) ? $config['compleSql'] : false;

			if(isset($config['id'])){

				$compleSql .= " AND id = '".$config['id']."'";

			}



			$dadosCli = dados_tab($GLOBALS['tab15'],'*',"WHERE Celular='".$config['celular_completo']."' $compleSql AND ".compleDelete(),true);

			if($dadosCli){

				$ret['celular_completo'] = $config['celular_completo'];

				$ret['zapguru'] = lib_json_array($dadosCli[0]['zapguru']);

			}else{

				$ret['mens'] = formatMensagem('Cliente não encontrado','danger');

			}

		}else{

			$ret['mens'] = formatMensagem('Telefone não informado','danger');

		}

		return $ret;

	}

	function atualizarCampos($config=false){

		//Exemplo de uso

		/*

		$zg = new zapguru;

		$ret = $zg->atualizarCampos(array('celular_completo'=>'(32)98474-8644'));

		*/

		$ret['exec'] = false;
		$link_orcamento = isset($config['link_orcamento']) ? $config['link_orcamento'] : false;
		if(!$link_orcamento && isset($config['tk_matricula']) && ($tk_matricula=$config['tk_matricula'])){
			$dm = (new MatriculasController)->dm($tk_matricula);
			// dd(isset($dm[0]['Celular']));
			if(isset($dm['link_orcamento'])){
				$link_orcamento = $dm['link_orcamento'];
			}
		}
		if(isset($config['celular_completo']) || isset($config['telefonezap'])){
			if(empty($config['celular_completo']) && isset($config['telefonezap'])){
				$csqlCli = " AND telefonezap='".$config['telefonezap']."'";
			}else{
				$csqlCli = " AND Celular='".$config['celular_completo']."'";
			}

			$dadosCli = Qlib::dados_tab($GLOBALS['tab15'],['campos'=> '*', 'where'=> "WHERE ".Qlib::compleDelete()."$csqlCli"]);

			if(!$dadosCli){

				$ret['mens'] = Qlib::formatMensagem0('Cliente não encontrado!','danger');

				return $ret;

			}


			if(Qlib::isJson($dadosCli[0]['zapguru'])){

				$arr_zap = Qlib::lib_json_array($dadosCli[0]['zapguru']);
				// dd($arr_zap);

				if(isset($arr_zap['celular'])){

					$chat_number = $arr_zap['celular'];

				}

			}else{



				$pais = !empty($dadosCli[0]['pais'])?$dadosCli[0]['pais']:'Brasil';

				$codi_pais = false;

				if($pais=='Brasil'){

					$codi_pais = '55';

				}

				//$ret['dadosCli'] = $dadosCli;

				$Celular 	 	= str_replace('(','',$dadosCli[0]['Celular']);

				$Celular 		= str_replace(')','',$Celular);

				$Celular 		= str_replace('-','',$Celular);

				$chat_number 	= $codi_pais.$Celular;

			}

			$nome 		 	= isset($dadosCli[0]['Nome'])?$dadosCli[0]['Nome'] 	:false;

			$sobrenome 		= isset($dadosCli[0]['sobrenome']) ? $dadosCli[0]['sobrenome'] 	:false;

			$name  = urlencode($nome.' '.$sobrenome);

			$cpf 		 	= $dadosCli[0]['Cpf'];

			$email 		 	= rtrim($dadosCli[0]['Email']);

			$telefone	 	= $dadosCli[0]['Celular'] ? $dadosCli[0]['Celular'] : @$dadosCli[0]['telefonezap'];

			$obs	 		= $dadosCli[0]['Obs'];

			$dialog_id 		= '6048d4bd171c171fcaa81c0d';

			$action 		= 'chat_update_custom_fields';

			$ret['config'] = $config;

			$curl 		 	= curl_init();
			$compleUrl = false;
			$key = 'FQXSYNB8GPSPALZ3MIC5O618HDP0OVUBRFCZ2LAZ4XCLVA44ZA8FPOJM8UG08IJ9';
			$phone_id = '628d294cc5ef6cb21b445e47';
			$account_id = '5f36da757e786f40069aa881';
			if($link_orcamento){
				$compleUrl = '&field__Link_da_proposta='.$link_orcamento;
			}
			$urlReq = 'https://s4.chatguru.app/api/v1?key='.$key.'&account_id='.$account_id.'&phone_id='.$phone_id.'&action='.$action.'&field__Nome='.$name.'&field__Telefone='.$telefone.'&field__ID_do_cliente='.$dadosCli[0]['id'].'&field__Email='.$email.$compleUrl.'&chat_number='.$chat_number;
			$curl = curl_init();

			curl_setopt_array($curl, array(
				CURLOPT_URL => $urlReq,
				CURLOPT_RETURNTRANSFER => true,
				CURLOPT_ENCODING => '',
				CURLOPT_MAXREDIRS => 10,
				CURLOPT_TIMEOUT => 0,
				CURLOPT_FOLLOWLOCATION => true,
				CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
				CURLOPT_CUSTOMREQUEST => 'POST',
			));

			$response = curl_exec($curl);

			curl_close($curl);
			$ret['urlReq'] = $urlReq;
			$ret['response_json'] = $response;
			$ret['response'] = Qlib::lib_json_array($response,true);

			if(isset($ret['response']['code'])&&$ret['response']['code']==200){

				$ret['exec'] = true;

			}

			if(isset($ret['response']['description'])&&isset($ret['response']['result'])){

				$css = 'danger';

				if($ret['response']['result']=='success'){

					$css = $ret['response']['result'];

				}

				$ret['mens'] = Qlib::formatMensagem($ret['response']['description'],$css);

			}

		}

		return $ret;

	}

	function atualizaCamposLinkOrcamento($tk_matricula){
		//Atualiza campo personalizado link orçamento
		$ret['exec'] = false;
		/*
		$ret = (new zapguru)->atualizaCamposLinkOrcamento($tk_matricula='');
		*/
		if($tk_matricula){
			$dm = cursos::dadosMatricula($tk_matricula);
			// dd(isset($dm[0]['Celular']));
			if(isset($dm[0]['link_orcamento'])){
				$ret = $this->atualizarCampos([
					'celular_completo'=>$dm[0]['Celular'],
					'telefonezap'=>$dm[0]['telefonezap'],
					'link_orcamento'=>$dm[0]['link_orcamento'],
				]);
			}
			if(isAdmin(1))
			$ret['dm'] = $dm;
		}
		return $ret;
	}
	function maskTelefone($telefone=false){

		$ret = false;

		//o telefone é no formato do zapguru

		if($telefone){

			$leng = strlen($telefone);

			$codi_pais = 0;

			if($leng==13){

				$codi_pais = substr($telefone,0,-11);

				$telefone = substr($telefone,2);

			}elseif($leng==12){

				$codi_pais = substr($telefone,0,-10);

				$telefone = substr($telefone,2);

			}

			if($codi_pais=='55'){

				$leng2 = strlen($telefone);

				$novoTel = false;

				if($leng2==11){

					$arr_tel = str_split($telefone);

					if(is_array($arr_tel)){

						foreach($arr_tel As $k=>$v){

							if($k==0){

								$novoTel .= '('.$v;

							}elseif($k==2){

								$novoTel .= ')'.$v;

							}elseif($k==7){

								$novoTel .= '-'.$v;

							}else{

								$novoTel .= $v;

							}



						}

					}

				}elseif($leng2==10){

					$arr_tel = str_split($telefone);

					if(is_array($arr_tel)){

						foreach($arr_tel As $k=>$v){

							if($k==0){

								$novoTel .= '('.$v;

							}elseif($k==2){

								$novoTel .= ')9'.$v;

							}elseif($k==6){

								$novoTel .= '-'.$v;

							}else{

								$novoTel .= $v;

							}



						}

					}

				}

				$ret = $novoTel;

			}

		}

		return $ret;

	}

	function atualizaCliente($config=false){

		//Exemplo de uso

		/*

		$config = '{

		  "campanha_id": "",

		  "campanha_nome": "chat iniciado",

		  "origem": "chat_plataforma",

		  "email": "5532984748644@c.us",

		  "nome": "Fernando Teste",

		  "tags": [],

		  "texto_mensagem": "",

		  "campos_personalizados": {},

		  "bot_context": {},

		  "responsavel_nome": "Fernando",

		  "responsavel_email": "fernando@maisaqui.com.br",

		  "link_chat": "https://s4.chatguru.app/chats#6055065c2e95690bc60d89fe",

		  "celular": "5532984748644",

		  "phone_id": "5fb9305b5e3b368d9f99020c",

		  "chat_id": "6055065c2e95690bc60d89fe",

		  "chat_created": "2021-03-19 20:15:24.955000",

		  "datetime_post": "2021-03-20 08:08:48.690948"

		}';//resposta no webhook

		$zg = new zapguru;

		$ret = $zg->atualizaCliente($config);

		*/



		$ret['exec'] = false;

		if(Qlib::isJson($config)){

			$arr_conf = Qlib::lib_json_array($config);
			if(isset($arr_conf['celular'])){

				$celular = $this->maskTelefone($arr_conf['celular']);

				if(!$celular)

					return $ret;



				$where = "WHERE Celular='".$celular."' AND ".Qlib::compleDelete();

				$dadosCli = Qlib::dados_tab($GLOBALS['tab15'],['campos'=>'*','where'=>$where]);

				if(!$dadosCli){
					$celular = $arr_conf['celular'];

					$where = "WHERE telefonezap='".$celular."' AND ".Qlib::compleDelete();
				}

				$ret['exec'] = Qlib::update_tab('clientes',['zapguru'=>addslashes($config)],$where);
				// echo $where;
				dd($ret);
				if(isset($arr_conf['origem']) && $arr_conf['origem']=='envia_campos'&&is_array($arr_conf['campos_personalizados'])){

					$post['conf'] = 's';

					if($dadosCli){

						$post['token'] 	= $dadosCli[0]['token'];

						$ac				= 'alt';

					}else{

						$post['token'] 	= uniqid();

						$post['zapguru']= $config;

						$ac				= 'cad';

					}

					foreach($arr_conf['campos_personalizados'] As $k=>$v){

						if($k == 'Nome'){

							$nom = explode(' ',$v);

							$sobrenome = str_replace($nom[0],'',$v);

							$post[$k] = $nom[0];

							$post['sobrenome'] = $sobrenome;

						}else{

							$post[$k] = $v;

						}

					}

					$cond_valid = $where;

					$type_alt = 1;

					$config2 = array(

						'tab'=>$GLOBALS['tab15'],

						'valida'=>true,

						'condicao_validar'=>$cond_valid,

						'sqlAux'=>false,

						'ac'=>$ac,

						'type_alt'=>$type_alt,

						'dadosForm' => $post

					);

					// $ret['atualizarCampos'] = lib_json_array(lib_salvarFormulario($config2));//Declado em Lib/Qlibrary.php
					$ret['atualizarCampos'] = Qlib::update_tab('clientes',$post,$cond_valid);

				}else{

					$ret['atualizarCampos'] = $this->atualizarCampos(array('celular_completo'=>$celular));

					$ret['exec'] = $ret['atualizarCampos']['exec'];

				}

				//$ret['mens'] = $ret['atualizarCampos']['mens'];

				//$ret['dadosCli'] = $dadosCli;

			}

		}

		return $ret;

	}

	function btnZapGuru($id_cliente=false){

		/*

		$zg = new zapguru;

		$ret = $zg->btnZapGuru($config);

		*/

		$ret = false;

		if($id_cliente){

			$dadosCli = dados_tab($GLOBALS['tab15'],'zapguru,Celular',"WHERE id='".$id_cliente."'");

			if(isJson($dadosCli[0]['zapguru'])){

				$arr_zap = lib_json_array($dadosCli[0]['zapguru']);

				if(isset($arr_zap['link_chat'])&&!empty($arr_zap['link_chat'])){

					$arr_zap['link_chat'] = str_replace('app4.zap.guru','s4.chatguru.app',$arr_zap['link_chat']);
					$ret['script'] = '<script>$(function(){ zapguru_btnAbrirChat(\''.$arr_zap['link_chat'].'\');});</script>';

				}

			}else{

				//if(isAdmin(1)){

				if(isset($dadosCli[0]['Celular'])&&!empty($dadosCli[0]['Celular'])){

					$conf_di = array('celular_completo'=>$dadosCli[0]['Celular']);

					$ret['dialog_execute'] = $this->dialog_execute($conf_di);

					if($ret['dialog_execute']['exec']){

						//$exec_dialog = json_encode($dialog_execute);

					}else{

						$conf_di['phone_id'] = '600ef75509c6487a5aaff0c2';

						$ret['dialog_execute'] = $this->dialog_execute($conf_di);

						//$exec_dialog = json_encode($dialog_execute);

					}

					if(!$ret['dialog_execute']['exec']&&isset($conf_di['celular_completo'])){

						$conf_di['celular_completo'] = str_replace(')9',')',$conf_di['celular_completo']);

						if($ret['dialog_execute']['exec']){

							//$exec_dialog = json_encode($dialog_execute);

						}else{

							$conf_di['phone_id'] = '600ef75509c6487a5aaff0c2';

							$ret['dialog_execute'] = $this->dialog_execute($conf_di);

							//$exec_dialog = json_encode($dialog_execute);

						}

					}

				}

					$ret['script'] = '<script>$(function(){ zapguru_criarChat(\''.$dadosCli[0]['Celular'].'\');});</script>';

				//}

			}

		}

		return $ret;

	}
	/**
	 * Metodo para retornar as tags da string zapguru retorna tags formatadas
	 * @param string $string_zapguru string da requisição do zapguru salva no banco de dados
	 * @param string $html string contento as tags badg
	 * @uso (new zapguru)->get_tags($string_zapguru);
	 */
	public function get_tags($string_zapguru){
		$ret = false;
		if(Qlib::isJson($string_zapguru)){
			$tm = '<span class="badge">{tag}</span><br>';
			$arr = Qlib::lib_json_array($string_zapguru);
			if(isset($arr['tags']) && is_array($arr['tags'])){
				foreach ($arr['tags'] as $v) {
					$ret .= str_replace('{tag}',$v,$tm);
				}
			}
		}
		return $ret;
	}
    /**
     * Verifica se o cliente ou o lead ja tem ja tem o um link chatguru atravez do campo verificador da tabela dele
     *
     */
    public function client_link_chat($tab='',$campo_bus='',$valor_bus='',$campo_enc='zapguru')
    {
        $json = Qlib::buscaValorDb0($tab,$campo_bus,$valor_bus,$campo_enc);
        //Verificar se o cadastro de cliente ja tem um link chat
        $link_chat = $this->link_chat($json);
        return $link_chat;
    }
}
