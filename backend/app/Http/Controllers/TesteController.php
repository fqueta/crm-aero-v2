<?php

namespace App\Http\Controllers;

use App\Http\Controllers\api\PdfController;
use App\Http\Controllers\api\ZapsingController;
use App\Services\Escola;
use App\Services\Qlib;
use Illuminate\Http\Request;
use App\Helpers\StringHelper;
use App\Http\Controllers\api\MatriculaController;
use App\Http\Controllers\api\OrcamentoController;
use Database\Seeders\MenuSeeder;
use App\Http\Controllers\api\ZapguruController;

class TesteController extends Controller
{
    public function index(Request $request){
        // $d = $request->all();
        $ret = [];
        $zgc = new ZapguruController();
        $id = $request->get('id');
        // $matSituacaoIdData = Qlib::get_post_id_by_slug('mat');
        // dd($matSituacaoIdData);
        // $helper = new StringHelper();
        // $ret = $helper->formatarCpf('12345678900');
        // $ret = $helper->formatarCpf('12345678900');
        // $ret = Escola::campo_emissiao_certificado();
        // $ret = Escola::dadosMatricula('6875579b0c808');
        // $ret = Qlib::dataLocal();
        // $ret = Qlib::add_user_tenant('demo2','cliente1.localhost');
        // $id_turma = $request->get('id_turma');
        // $ret = [];
        // if($id_turma){
        //     // $ret = Escola::adiciona_presenca_atividades_cronograma($id_turma);
        //     // dd($ret);
        // }
        // $ret = Qlib::get_post_by_shortcode('fundo_proposta_plano');
        // dd($ret);
        // $pid = $request->get('id');
        // if($pid){
        //     $ret = (new MenuController)->getMenus($pid);
        //     // dd($ret);
        //     return response()->json($ret);
        // }
        // $ret = (new OrcamentoController)->resumo_proposta_periodos($id??'');
        // $ret = (new MatriculaController)->contratos_periodos($id??'');
        // $ret = (new MatriculaController)->contratos_periodos_pdf($id??'');
        $ret = (new MatriculaController)->contratos_periodos_pdf($id??'');
        // $ret = (new PdfController())->matricula($request, $id??'');
        // $ret = (new \App\Http\Controllers\api\ZapsingController)->enviar_envelope($id??'');
        // $ret = (new MatriculaController)->send_to_zapSing($id??'');

        // $ret['enviar_link_assinatura'] = (new ZapsingController())->enviar_link_assinatura($id);
        // $ret = (new MenuController)->getMenus(1);
        // $ret = Qlib::token();
        // $telefonezap = $zgc->get_telefonezap_by_id_matricula($id);
        // $ret = (new ZapsingController())->enviar_link_assinatura($id);
        return $ret;
    }
}
