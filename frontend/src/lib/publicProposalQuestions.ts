export type PublicProposalQuestionKey =
  | 'foi_transferido'
  | 'cma_em_dia'
  | 'classe_cma'
  | 'possui_banca'
  | 'aluno_ciente_taxa_manutencao_alojamento'
  | 'aluno_ciente_hora_seca'
  | 'aluno_ciente_headset'
  | 'aluno_ciente_prazo_estimado'
  | 'aluno_ciente_limite_c150'
  | 'aluno_ciente_documentacao_ground_school'
  | 'aluno_ciente_uniforme';

export type PublicProposalQuestionStage = 'signature' | 'approval';
export type PublicProposalQuestionSection = 'status' | 'info';
export type PublicProposalSectionConfig = Record<PublicProposalQuestionSection, boolean>;

export interface PublicProposalQuestionOption {
  value: string;
  label: string;
}

export interface PublicProposalQuestionDefinition {
  key: PublicProposalQuestionKey;
  section: PublicProposalQuestionSection;
  kind: 'boolean' | 'select';
  label: string;
  options?: PublicProposalQuestionOption[];
}

export const PUBLIC_PROPOSAL_QUESTIONS: PublicProposalQuestionDefinition[] = [
  { key: 'foi_transferido', section: 'status', kind: 'boolean', label: 'Foi transferido' },
  { key: 'cma_em_dia', section: 'status', kind: 'boolean', label: 'CMA em dia' },
  {
    key: 'classe_cma',
    section: 'status',
    kind: 'select',
    label: 'Classe do CMA',
    options: [
      { value: '1ª Classe', label: '1ª Classe' },
      { value: '2ª Classe', label: '2ª Classe' },
    ],
  },
  { key: 'possui_banca', section: 'status', kind: 'boolean', label: 'Possui banca' },
  {
    key: 'aluno_ciente_taxa_manutencao_alojamento',
    section: 'info',
    kind: 'boolean',
    label: 'Aluno ciente da taxa de manutenção do alojamento',
  },
  {
    key: 'aluno_ciente_hora_seca',
    section: 'info',
    kind: 'boolean',
    label: 'Aluno ciente da hora seca',
  },
  {
    key: 'aluno_ciente_headset',
    section: 'info',
    kind: 'boolean',
    label: 'Aluno ciente que deve trazer seu próprio headset',
  },
  {
    key: 'aluno_ciente_prazo_estimado',
    section: 'info',
    kind: 'boolean',
    label: 'Aluno ciente de que o prazo de conclusão é estimado',
  },
  {
    key: 'aluno_ciente_limite_c150',
    section: 'info',
    kind: 'boolean',
    label: 'Aluno ciente do limite para voar no C150/C152',
  },
  {
    key: 'aluno_ciente_documentacao_ground_school',
    section: 'info',
    kind: 'boolean',
    label: 'Aluno ciente da exigência documental para Ground School e horas de voo',
  },
  {
    key: 'aluno_ciente_uniforme',
    section: 'info',
    kind: 'boolean',
    label: 'Aluno ciente da obrigatoriedade do uniforme nas horas práticas',
  },
];

export const PUBLIC_PROPOSAL_QUESTION_KEYS = PUBLIC_PROPOSAL_QUESTIONS.map(
  (question) => question.key
);

export const PUBLIC_PROPOSAL_SECTIONS: Array<{
  key: PublicProposalQuestionSection;
  label: string;
}> = [
  { key: 'status', label: 'Situação Atual' },
  { key: 'info', label: 'Informações Passadas' },
];

/**
 * groupConfiguredQuestionsBySection
 * pt-BR: Agrupa as perguntas configuradas por seção para apoiar a resolução
 *        automática da visibilidade das seções.
 * en-US: Groups configured questions by section to support automatic section
 *      visibility resolution.
 */
function groupConfiguredQuestionsBySection(keys: PublicProposalQuestionKey[]): PublicProposalSectionConfig {
  return keys.reduce<PublicProposalSectionConfig>(
    (acc, key) => {
      const question = PUBLIC_PROPOSAL_QUESTIONS.find((item) => item.key === key);
      if (question) {
        acc[question.section] = true;
      }
      return acc;
    },
    { status: false, info: false }
  );
}

/**
 * isAdministrativeCourseType
 * pt-BR: Identifica cursos administrativos compatíveis com as perguntas públicas.
 * en-US: Identifies administrative course types compatible with public questions.
 */
export function isAdministrativeCourseType(courseType: unknown): boolean {
  const normalized = String(courseType ?? '').trim();
  return normalized === '2' || normalized === '2.0';
}

/**
 * getDefaultPublicProposalQuestions
 * pt-BR: Define o comportamento padrão quando o curso ainda não possui configuração explícita.
 * en-US: Defines fallback behavior when the course has no explicit question config yet.
 */
export function getDefaultPublicProposalQuestions(
  stage: PublicProposalQuestionStage,
  courseType: unknown
): PublicProposalQuestionKey[] {
  if (!isAdministrativeCourseType(courseType)) {
    return [];
  }

  if (stage === 'signature') {
    return [...PUBLIC_PROPOSAL_QUESTION_KEYS];
  }

  return [];
}

/**
 * getDefaultPublicProposalRequiredQuestions
 * pt-BR: Define o fallback de obrigatoriedade das perguntas públicas.
 * en-US: Defines the fallback for required public questions.
 */
export function getDefaultPublicProposalRequiredQuestions(
  _stage: PublicProposalQuestionStage,
  _courseType: unknown
): PublicProposalQuestionKey[] {
  return [];
}

/**
 * getDefaultPublicProposalSections
 * pt-BR: Define a visibilidade padrão das seções públicas quando o curso ainda
 *        não possui configuração explícita.
 * en-US: Defines default visibility for public sections when the course has no
 *      explicit configuration yet.
 */
export function getDefaultPublicProposalSections(
  stage: PublicProposalQuestionStage,
  courseType: unknown
): PublicProposalSectionConfig {
  if (!isAdministrativeCourseType(courseType)) {
    return { status: false, info: false };
  }

  if (stage === 'signature') {
    return { status: true, info: true };
  }

  return { status: false, info: false };
}

/**
 * resolvePublicProposalQuestions
 * pt-BR: Resolve as perguntas visíveis por etapa usando a configuração do curso ou fallback.
 * en-US: Resolves visible questions per stage using course config or fallback.
 */
export function resolvePublicProposalQuestions(
  config: any,
  stage: PublicProposalQuestionStage,
  courseType: unknown
): PublicProposalQuestionKey[] {
  const configured = stage === 'signature'
    ? config?.public_signature_questions
    : config?.public_approval_questions;

  if (Array.isArray(configured)) {
    return configured.filter((key): key is PublicProposalQuestionKey =>
      PUBLIC_PROPOSAL_QUESTION_KEYS.includes(key as PublicProposalQuestionKey)
    );
  }

  return getDefaultPublicProposalQuestions(stage, courseType);
}

/**
 * resolvePublicProposalRequiredQuestions
 * pt-BR: Resolve as perguntas obrigatórias por etapa usando a configuração do
 *        curso e limitando ao conjunto de perguntas visíveis.
 * en-US: Resolves required questions per step using course config and limiting
 *      the result to the set of visible questions.
 */
export function resolvePublicProposalRequiredQuestions(
  config: any,
  stage: PublicProposalQuestionStage,
  courseType: unknown
): PublicProposalQuestionKey[] {
  const configured = stage === 'signature'
    ? config?.public_signature_required_questions
    : config?.public_approval_required_questions;
  const visibleQuestions = resolvePublicProposalQuestions(config, stage, courseType);

  if (Array.isArray(configured)) {
    return configured.filter((key): key is PublicProposalQuestionKey =>
      visibleQuestions.includes(key as PublicProposalQuestionKey)
    );
  }

  return getDefaultPublicProposalRequiredQuestions(stage, courseType).filter((key) =>
    visibleQuestions.includes(key)
  );
}

/**
 * getStudentFacingQuestionLabel
 * pt-BR: Ajusta o texto exibido ao aluno no formulário público sem alterar os
 *        rótulos internos usados no cadastro/configuração do curso.
 * en-US: Adjusts the label shown to students in the public form without changing
 *      internal labels used in course settings.
 */
export function getStudentFacingQuestionLabel(label: string, section: PublicProposalQuestionSection): string {
  if (section !== 'info') {
    return label;
  }

  const normalized = label.replace(/^Aluno ciente/i, 'Estou ciente');

  const replacements: Array<[RegExp, string]> = [
    [/^Estou ciente que\b/i, 'Estou ciente de que'],
    [/^Estou ciente da taxa\b/i, 'Estou ciente da taxa'],
    [/^Estou ciente da hora seca\b/i, 'Estou ciente da hora seca'],
    [/^Estou ciente de que deve trazer seu próprio headset\b/i, 'Estou ciente de que devo trazer meu próprio headset'],
    [/^Estou ciente que deve trazer seu próprio headset\b/i, 'Estou ciente de que devo trazer meu próprio headset'],
    [/^Estou ciente da exigência documental para Ground School e horas de voo\b/i, 'Estou ciente da exigência documental para Ground School e horas de voo'],
    [/^Estou ciente da obrigatoriedade do uniforme nas horas práticas\b/i, 'Estou ciente da obrigatoriedade do uniforme nas horas práticas'],
    [/^Estou ciente do limite para voar no C150\/C152\b/i, 'Estou ciente do limite para voar no C150/C152'],
  ];

  return replacements.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), normalized);
}

/**
 * resolvePublicProposalSections
 * pt-BR: Resolve quais seções devem aparecer em cada etapa com fallback
 *        compatível para cursos antigos.
 * en-US: Resolves which sections should appear in each step with a backward
 *      compatible fallback for legacy courses.
 */
export function resolvePublicProposalSections(
  config: any,
  stage: PublicProposalQuestionStage,
  courseType: unknown
): PublicProposalSectionConfig {
  const configured = stage === 'signature'
    ? config?.public_signature_sections
    : config?.public_approval_sections;

  if (configured && typeof configured === 'object') {
    const configuredQuestions = resolvePublicProposalQuestions(config, stage, courseType);
    const sectionsFromQuestions = groupConfiguredQuestionsBySection(configuredQuestions);

    return {
      status: Boolean(configured.status) || sectionsFromQuestions.status,
      info: Boolean(configured.info) || sectionsFromQuestions.info,
    };
  }

  return getDefaultPublicProposalSections(stage, courseType);
}
