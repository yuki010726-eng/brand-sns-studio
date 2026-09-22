/**
 * 블로그형 전용 세부안.
 *
 * 광고형의 AD_CONCEPTS와 같은 역할을 한다. 새 블로그형 시안은 이 배열에
 * 추가하고, 필요한 경우 style/layouts/previewImage만 바꾸면 된다.
 */
export const BLOG_CONCEPTS = [
  {
    id: "editorial-pr",
    name: "기본 PR 에디토리얼",
    previewImage: "/concept-preview/blog-1.png",
    style: [
      "premium Korean corporate editorial photograph for a trustworthy blog article; choose a distinctive, subject-appropriate color palette rather than a fixed house palette",
      "realistic Korean business setting, polished award plaque or certificate, newspaper, article page, laptop screen or framed recognition material only when relevant to the subject",
      "use color, lighting and material tones that fit the subject and brand; retain clear hierarchy and enough calm space for editorial copy",
      "high-end public-relations campaign visual, sharp focus, refined materials, true-to-life colors",
    ].join(", "),
    layouts: [
      "asymmetric editorial split: reserve one side for copy and let a single hero scene occupy the opposite side; choose which side best serves the subject",
      "immersive full-bleed hero composition: integrate the copy into a quiet high-contrast area within the scene, with the subject large and deliberately cropped",
      "editorial collage composition: combine one dominant image with one or two restrained supporting details in an offset grid; place copy in the clearest remaining block",
      "structured information-story composition: arrange the subject, a concise visual sequence or diagram-like supporting elements, and copy in clearly distinct zones without a conventional left/right split",
    ],
  },
  {
    id: "people-at-work",
    name: "현장 인물 스토리",
    previewImage: "/concept-preview/blog-people-at-work.png",
    peopleOnly: true,
    style: [
      "premium documentary-style Korean editorial photography for a trustworthy blog article",
      "show two to five Korean people with East Asian faces actively carrying out the real service, craft, consultation, training, or work described by the subject",
      "candid collaboration and visible hands at work; authentic professional uniforms, tools, workspace and safety details only when relevant",
      "a believable in-progress moment, not a posed group portrait; natural expressions, true-to-life color, sharp focus, refined commercial photography",
    ].join(", "),
    layouts: [
      "wide on-location documentary shot: a small team works together around the real task, with the action clearly visible",
      "immersive over-the-shoulder work scene: one person performs the task while colleagues or a customer naturally participate nearby",
      "observational workshop or service-floor scene: people, tools and the subject action form one coherent moment with natural depth",
      "close collaborative detail: hands at work in the foreground with the people performing the service visibly connected to the action",
    ],
  },
  {
    id: "illustrated-policy",
    name: "\uC815\uCC45 \uC77C\uB7EC\uC2A4\uD2B8",
    previewImage: "/concept-preview/blog-illustrated-policy.png",
    style: [
      "polished Korean public-service campaign illustration for a trustworthy blog article",
      "friendly Korean and East Asian people, startup founders, advisors, local communities, and the concrete subject of the article rendered as clear editorial illustration rather than photography",
      "refined dark-navy linework with soft sky-blue, teal, green, coral, and warm yellow color blocks; modern information-graphic clarity with a human, optimistic mood",
      "integrate a small number of subject-relevant supporting symbols such as a lightbulb, growth chart, handshake, shop, map, gear, or community scene only when they genuinely support the article",
      "clean professional Korean policy-promotion visual, expressive but restrained, high-quality illustration, no photorealism",
    ].join(", "),
    layouts: [
      "central illustration-story composition: make the concrete subject or people the focal point, then let a few connected support icons explain its impact around it; reserve a calm block for copy",
      "four-part support-path layout: arrange three or four simple illustrated scenes or panels that show the article's process, benefit, or audience, while leaving a clear headline area",
      "optimistic wide infographic landscape: connect a hero illustration with a restrained flowing path of subject-relevant symbols, community scenes, or outcomes; keep the copy zone clean and legible",
      "editorial illustration with a large emblem or object: place the article's people and concrete situation around a single symbolic focal object, with enough quiet space for the headline and supporting copy",
    ],
  },
];

export const DEFAULT_BLOG_CONCEPT = BLOG_CONCEPTS[0].id;

export const getBlogConcept = (id) =>
  BLOG_CONCEPTS.find((concept) => concept.id === id) || BLOG_CONCEPTS[0];
