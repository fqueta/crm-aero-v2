<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\admin\ZapsingController;
use App\Http\Controllers\Controller;
use App\Http\Controllers\CursosController;
use App\Http\Controllers\PdfGenerateController;
use App\Services\Qlib;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrcamentoController extends Controller
{
    /**
     * Grava um orçamento de uma requisição da API
     */
    public function gerar_orcamento(Request $request)
    {
        $d = $request->all();
        $ret = ['exec'=>false];
        if(isset($d['id_cliente']) && isset($d['id_curso'])){
            $d['token'] 	= isset($d['token'])	?$d['token']	:uniqid();
            $d['status'] 	= isset($d['status'])	?$d['status']	:1;
            $d['situacao'] 	= isset($d['situacao'])	?$d['situacao']	:'a';
            $d['excluido'] 	= isset($d['excluido'])	?$d['excluido']	:'n';
            $d['deletado'] 	= isset($d['deletado'])	?$d['deletado']	:'n';
            $d['ac'] 	= isset($d['ac'])	?$d['ac']	:'cad';
            $d['id_responsavel'] = isset($d['id_responsavel'])	? $d['id_responsavel']	: 0;
            $d['etapa_atual'] = isset($d['etapa_atual']) ? $d['etapa_atual'] : 4; //Lead interessado
            //agora precisamos gerar um valor padrão
            $cursos_c = new CursoController;
            $mc = new MatriculaController;
            if($d['ac']=='cad' && isset($d['id_curso'])){
                $tipo_curso = $cursos_c->tipo($d['id_curso']);
                if($tipo_curso==1){
                    $total_curso = Qlib::buscaValorDb0('cursos','id',$d['id_curso'],'valor');
                }else{
                    $total_curso = 0;
                }
                $d['total'] = $total_curso;
                $d['valor'] = isset($d['valor']) ? $d['valor'] : 0; //Lead interessado
                $d['acao'] = $d['ac'];
                $d['html_exibe'] = false;
                $turmas = $cursos_c->selectTurma($d);
                $d['id_turma'] = isset($turmas['arr_id_turma'][0]) ? $turmas['arr_id_turma'][0] : 0;
                $arr_tabelas = $this->select_tabela_preco($d['id_curso'],$d['id_turma']);
                if($tipo_curso==2 && $arr_tabelas){
                    //array de orçamento
                    $d['orc'] = '';
                    $sele_valores = isset($arr_tabelas['dados'][0]['nome']) ? $arr_tabelas['dados'][0]['nome'] : '';
                    if($arr_tabelas){
                        $orc = [
                            'sele_valores'=>$sele_valores,
                            'sele_pag_combustivel'=>'por_voo',
                        ];
                        $d['orc'] = Qlib::lib_array_json($orc);
                    }
                    $d['id_turma'] = isset($turmas['arr_id_turma'][0]) ? $turmas['arr_id_turma'][0] : 0;
                    // dd($arr_tabelas);
                }
            }
            $ret = $mc->salvarMatricula($d);
            if(is_string($ret)){
                $ret = Qlib::lib_json_array($ret);
            }
            if(isset($ret['exec']) && isset($ret['idCad']) && ($id_matricula = $ret['idCad'])){
                $id_matricula = base64_encode($id_matricula);
                $link = Qlib::raiz().'/admin/cursos?sec=aW50ZXJlc3NhZG9z&list=false&regi_pg=100&pag=0&acao=alt&id='.$id_matricula.'&redirect_base=aHR0cHM6Ly9jcm0uYWVyb2NsdWJlamYuY29tLmJyL2FkbWluL2N1cnNvcz9zZWM9YVc1MFpYSmxjM05oWkc5eg==';
                $ret['link_proposta_admin'] = $link;
            }
            if(isset($ret['exec']) && isset($ret['dados']['token']) && ($token_matricula = $ret['dados']['token'])){
                $link_cliente = 'https://propostas.aeroclubejf.com.br/orcamento-pdf/'.$token_matricula;
                $ret['link_proposta_cliente'] = $link_cliente;
            }
        }
        return $ret;
        // dd($d);
    }
    /**
     * Gera um array contendo uma lista de todas as tabelas disponiveis para a turma e o curso selecionado
     */
    public function select_tabela_preco($id_curso,$id_turma=0){
        $token_curso = Qlib::buscaValorDb0('cursos','id',$id_curso,'token');
		if($id_turma){
            $token_turma = Qlib::buscaValorDb0('turmas','id',$id_turma,'token');
            $sql = "SELECT * FROM tabela_nomes WHERE ativo = 's' AND libera = 's' AND ".Qlib::compleDelete()." AND (cursos LIKE '%".$token_curso."%') AND (turmas LIKE '%".$token_turma."%') ORDER BY nome ASC";
			$arr_tabelas = Qlib::sql_array($sql,'nome','url','','','',false);
            $dados = Qlib::buscaValoresDb($sql);
            // dd($arr_tabelas,$id_turma);
		}else{
            $sql = "SELECT * FROM tabela_nomes WHERE ativo = 's' AND libera = 's' AND ".Qlib::compleDelete()." AND (cursos LIKE '%".$token_curso."%' OR cursos='') ORDER BY nome ASC";
            $arr_tabelas = Qlib::sql_array($sql,'nome','url');
        }
        $dados = Qlib::buscaValoresDb($sql);
        $ret['dados'] = $dados;
        $ret['arr_tabelas'] = $arr_tabelas;
        return $ret;
    }

    /**
	 * Metodo que resume informações inportates de uma proposta de periodos do plano de formação
	 * @param string $id_matricula id da matricula
     * @return string $ret
     * @uso $ret = (new OrcamentoController)->resumo_proposta_periodos($tk);
	 */
	public function resumo_proposta_periodos($id_matricula,$d=false,$type='html'){
		$mc = new MatriculaController;
        // dd($id_matricula);
		if(!$d && $id_matricula){
            $d = $mc->dm($id_matricula);
		}
		$ret = false;
		if($d){
			$arr_periodo = $d['orc']['modulos'][0]??[];

            //pegar dados do periodo atualizado
            // $periodo = (new PeriodoController)->show($d['orc']['modulos'][0]['id']??'');
            // $id_contrato = $periodo->getData()->id_contratos??0;
            // dd($id_contrato);
            // $id_contrato = $periodo['id_contratos']??0;
            // dd($periodo,$id_contrato);
			// if($periodo){
			// 	//Verifica o peridodo
			// 	$arr_periodo = $d['orc']['modulos']['id_contratos']??[];//$mc->get_periodo_array($d['token'],'token',$periodo);
			// }
			//Verficar se ja existe um lancamento de ganho para este periodo...
			ob_start();
			$ali = 'text-right';
			$nome_turma = $d['turma_nome']??'';
			$link_proposta = $d['link_orcamento'];
			$forma_pagamento = false;
			$meta_proposta = Qlib::get_matriculameta($d['id'],'proposta');
			if($meta_proposta){
				$arr_m_p = Qlib::lib_json_array($meta_proposta);
				$forma_pagamento = isset($arr_m_p['forma_pagamento']) ? $arr_m_p['forma_pagamento'] : false;
			}
            //  dd($d);
			$totalProposta = Qlib::valor_moeda($d['total'],'R$');
			if($d['curso_tipo']!=4){

				$infoPag = Qlib::infoPagCurso([
					'token'=>$tk,
				]);
				if(isset($infoPag['valores']['forma_pagamento']) && !empty($infoPag['valores']['forma_pagamento'])){
					$forma_pagamento = $infoPag['valores']['forma_pagamento'];
				}
				$parcelas = false;
				if(isset($infoPag['valores']['parcelas']) && !empty($infoPag['valores']['parcelas'])){
					$parcelas = $infoPag['valores']['parcelas'].'X ';
				}
				if(isset($infoPag['valores']['total']) && !empty($infoPag['valores']['total'])){
					$totalProposta = $parcelas. '<b>'. Qlib::valor_moeda($infoPag['valores']['total'],'R$ ').'</b>';
				}
				if(isset($infoPag['valores']['total_parcelado']) && !empty($infoPag['valores']['total_parcelado'])){
					$totalProposta .= ' Total: '.Qlib::valor_moeda($infoPag['valores']['total_parcelado'],'R$ ');
				}
			}
			if(Qlib::is_admin_area()){
				if($type=='html'){
					$forma_pagamento = '<input type="text" class="form-control" name="meta[proposta][forma_pagamento]" value="'.$forma_pagamento.'" />';
				}
			}
			$nome_completo = $d['cliente_nome']??'';
			if(isset($_GET['fp'])){
				dump($arr_periodo);
			}

			$arr = [
				'Nome completo' => '<a href="'.Qlib::raiz().'/cad_clientes/?sec=Y2FkX2NsaWVudGVz&acao=alt&id='.base64_encode($d['id_cliente']).'&redirect_base='.base64_encode(Qlib::UrlAtual()).'" style="text-decoration:underline">'.$nome_completo.' </a>',
				'Curso adquirido' => $d['curso_nome'],
				'Horas teoricas' => isset($arr_periodo['h_teoricas'])?$arr_periodo['h_teoricas']:false,//$this->horas_proposta($d['token']),
				'Horas praticas' => isset($arr_periodo['h_praticas'])?$arr_periodo['h_praticas']:false,//$this->horas_proposta($d['token']),
				'Turma' => $nome_turma,
				'Periodo' => isset($arr_periodo['nome'])?$arr_periodo['nome']:false,
				'Valor da proposta' => isset($arr_periodo['valor'])?$arr_periodo['valor']:false,
				'Link da proposta' => $link_proposta,
				'Link para assinatura' => $d['link_assinatura'],
				'ID cliente' => $d['id_cliente'],
				'ID matrícula' => $d['id'],
				'Forma de pagamento' => $forma_pagamento,
			];
            $arr['valor'] = Qlib::valor_moeda($arr['Valor da proposta'],'R$ ');
			$meta_lead = isset($arr_m_p['lead_prospectado']) ? $arr_m_p['lead_prospectado'] : false;;
			if(Qlib::is_admin_area()){
				$arr['Lead prospectado por SDR'] = '<input type="text" class="form-control" name="meta[proposta][lead_prospectado]" value="'.$meta_lead.'" />';
			}else{
				unset($arr['Nome completo'],$arr['Link para assinatura'],$arr['Link da proposta']);
			}
			if($type=='zap' && Qlib::is_admin_area()){
				$vendedor = Qlib::buscaValorDb_SERVER('usuarios_sistemas','id',$d['seguido_por'],'nome');
				$arr['Nome completo'] = isset($d['nome_completo']) ? $d['nome_completo'] : $nome_completo;
				unset($arr['Link para assinatura']);
				$arr['Vendedor']=$vendedor;
				$arr['Data da venda'] = Qlib::dataExibe($d['data_situacao']);
				$arr['Link do guru']=isset($d['link_guru']) ? $d['link_guru'] : '';
				$arr['Lead prospectado por SDR']= $meta_lead;
			}
			$title = 'Informações da proposta';

			if($type=='html'){
			?>
			<div class="table-responsive">
				<table class="table table-striped">
					<thead>
						<tr>
							<th colspan="2" class="text-center">
								<h5>
									<?=$title?>
								</h5>
							</th>
						</tr>
					</thead>
					<tbody>
						<?
						foreach ($arr as $kt => $vt) {
						?>
						<tr>
							<th><?=$kt?>:</th>
							<td class="<?=$ali?>"><?=$vt?></td>
						</tr>
						<?
						}
						?>
					</tbody>
				</table>
			</div>
			<?
				$ret = ob_get_clean();
			}elseif($type=='zap'){
				$ret = '*'.$title.'*%0A--------%0A';
				foreach ($arr as $kt => $vt) {
					$ret .= '*'.$kt.':* '.$vt.'%0A';
				}
			}
		}
		return $ret;
	}
    /**
     * Gerar uma proposta em PDF do periodo especifico de uma matricula do plano de foramção
     */
    public function proposta_periodos_estatica($token,$periodo){
        $dm = (new MatriculaController)->dm($token);
        $ret = false;
        if($dm){
            $id = isset($dm['id']) ? $dm['id'] : null;
            $conteudo = $this->resumo_proposta_periodos($token,$dm,$periodo);
            $titulo = 'proposta_periodo';
            // dd($dm);
            $dados = [
                'html'=>$conteudo,
                'nome_aquivo_savo'=>$titulo,
                'titulo'=>'Proposta',
                'id_matricula'=>$id,
                'token'=>$token,
                'short_code'=>$titulo.'_'.$periodo,
                'pasta'=>'periodos/'.$periodo,
                'f_exibe'=>'server',
            ];
            $ret = (new PdfGenerateController)->convert_html($dados);
        }
        return $ret;
    }
    /**
     * Gera os dados para montar todas as paginas HMTL de propostas dos cliente, que ficam disponivel no site
     */
    public function pagina_orcamentos_site(Request $request,$sec,$token){
        // $dr = $request->all();
        // $token = $request->get('token');
        $token2 = $request->segment(4);
        $conteudo = '';
        $dados = [];
        $type=$request->get('type'); //token do periodo
        if($sec=='orcamentos'){
            $do = ( new MatriculaController )->gerar_orcamento($token);
            $conteudo = isset($do['table']) ? $do['table'] : false;
            $table2 = isset($do['table2']) ? $do['table2'] : false;
            $conteudo .= $table2;
            // $conteudo = (new MatriculaController)->orcamento_html($tk);
        }elseif($sec=='proposta-pnl-periodos'){
            $periodo=$token2; //token do periodo
            $d = (new MatriculaController)->dm($token);
            $conteudo = $this->resumo_proposta_periodos($token,$d,$periodo);
        }elseif($sec=='contratos' && $token=='vencidos'){
            $conteudo = 'Contratos vencidos';
            $dados = (new MatriculaController)->listar_contratos_vencendo(2);
        }elseif($sec=='ass'){
            $periodo=$token2; //token do periodo
            // $d = (new MatriculaController)->dm($token);
            $c = (new ZapsingController)->painel_assinaturas($token,$periodo);
            $conteudo = $c;
            // dd($c,$c->getData(),$c->getPath());
            // $conteudo = view('crm.painel.assinaturas',$c->getData());
        }
        $ret = [
            'conteudo'=>$conteudo,
            'sec'=>$sec,
            'dados'=>$dados,
        ];
        return view('site.index',$ret);
    }
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        //
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
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $d = request()->all();
        $token = $id;
        $exibe_parcelamento = isset($d['ep']) ? $d['ep'] : null;
        $ret = (new MatriculaController)->gerar_orcamento($token, $exibe_parcelamento);

        return response()->json($ret);
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
    /**
     * Para diparar a assinatura de uma proposta mediante o token da matricula
     */
    public function assinar_proposta(string $token){
        $d = request()->all();
        if(!isset($d['token_matricula'])){
            $d['token_matricula'] = $token;
        }
        $ret = (new MatriculaController)->assinar_proposta($d);
        return $ret;
    }
    /**
     * Para diparar a assinatura de uma proposta mediante o token da matricula
     */
    public function assinar_proposta_periodos(string $token){
        $d = request()->all();
        if(!isset($d['token_matricula'])){
            $d['token_matricula'] = $token;
        }
        $ret = (new MatriculaController)->assinar_proposta_periodo($d);
        return $ret;
    }

    public function add_update($config=[]){
        //indentificar o curso
        //selecionar a primeira turma disponivel
        //
    }
    /**
     * Webhook para interagir com o CRM
     */
    public function webhook($d=[]){
        $d['token_externo'] = isset($d['token_externo']) ? $d['token_externo'] : '';
        $id = isset($d['id']) ? $d['id'] : '';
        $ret['exec'] = false;
        $ret['status'] = 500;
        $ret['message'] = 'Error updating';
        $tab = 'matriculas';
        if($d){
            $ret['exec'] = DB::table($tab)->where('id',$id)->update($d);
            if($ret['exec']){
                //salvar um meta_campo
                if($id_contrato=$d['token_externo']){
                    $ret['meta'] = Qlib::update_matriculameta($id,'id_contrato_leilao',$id_contrato);
                }
                $ret['status'] = 200;
                $ret['message'] = 'updated successfully';
                $ret['data'] = DB::table($tab)->find($id);
            }
        }
        return response()->json($ret);
    }
}
