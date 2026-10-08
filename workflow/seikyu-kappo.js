// 公開用設計図: seikyu_kappo/workflow/generated/invoice-sorting.normalized.json
// データファイル・実行結果は含まない。
(function (root) {
  const definition = {
  "connections": [
    {
      "from": "ai-classification",
      "on": "現行の分類・評価結果を型検証",
      "to": "normalize"
    },
    {
      "from": "ai-field-recovery",
      "on": "根拠付き候補を人が確認する（既存OCR値を自動で上書きしない）",
      "to": "human-review"
    },
    {
      "from": "ai-ocr",
      "on": "補正前の形式検証完了（payee補正後の再検証は未実装）",
      "to": "ai-classification"
    },
    {
      "from": "ai-page-mapping",
      "on": "割当形式と既存伝票との対応を検証して保存・再構築（人の確認完了ではない）",
      "to": "normalize"
    },
    {
      "from": "ai-vendor-suggestion",
      "on": "提案だけを返し、人が登録・修正・統合の採否を判断",
      "to": "human-review"
    },
    {
      "from": "classification-only",
      "on": "計画: 分類と検算を完全分離",
      "to": "program-checks"
    },
    {
      "from": "human-reread-request",
      "on": "recover APIの個別実行、または一括OCR完了・再構築後の項目回復",
      "to": "ai-field-recovery"
    },
    {
      "from": "human-reread-request",
      "on": "一括実行の先行処理: 未解決の複数ページをmap_pagesへ",
      "to": "ai-page-mapping"
    },
    {
      "from": "human-reread-request",
      "on": "再読取実行: キャッシュされた抽出品質と元書類で方式選択を再実行・再開",
      "to": "ocr-route"
    },
    {
      "from": "human-review",
      "on": "業務手順: 確認後に出力（現行コードの必須ゲートではない）",
      "to": "aggregate-export"
    },
    {
      "from": "human-review",
      "on": "取引先提案を依頼し外部送信を確認",
      "to": "ai-vendor-suggestion"
    },
    {
      "from": "human-review",
      "on": "必要なら再読取をキューへ依頼、または既存キューを実行",
      "to": "human-reread-request"
    },
    {
      "from": "normalize",
      "on": "計画: 共通表から分類だけを行う",
      "to": "classification-only"
    },
    {
      "from": "normalize",
      "on": "現行: rebuildで独立検算",
      "to": "program-checks"
    },
    {
      "from": "ocr-route",
      "on": "ai_ocr選択、またはrun_pending_requestsが複数ページを強制AIへ上書き",
      "to": "ai-ocr"
    },
    {
      "from": "ocr-route",
      "on": "program/manual_review: fieldsは空・needs_review=true（バッチの複数ページ強制AIを除く）",
      "to": "human-review"
    },
    {
      "from": "program-checks",
      "on": "検算結果を元書類と照合",
      "to": "human-review"
    },
    {
      "from": "register",
      "on": "PDFのテキスト層を抽出",
      "to": "text-extract"
    },
    {
      "from": "register",
      "on": "画像入力: 空テキスト・image_inputとして品質判定",
      "to": "text-quality"
    },
    {
      "from": "text-extract",
      "on": "抽出完了後にdetect_text_qualityで判定",
      "to": "text-quality"
    },
    {
      "from": "text-quality",
      "on": "プログラム抽出が十分: text_extractedを正規化（AI再読取の対象となる場合もある）",
      "to": "normalize"
    },
    {
      "from": "text-quality",
      "on": "vision_requiredまたはAI読取キュー対象: 抽出品質をAI方式選択へ渡す",
      "to": "ocr-route"
    }
  ],
  "name": "invoice-sorting",
  "nodes": [
    {
      "id": "aggregate-export",
      "impl": [
        "scripts/03_export.py"
      ],
      "input": [
        "共通レコード",
        "銀行配分の確定情報（任意）"
      ],
      "learning": {
        "cases": [],
        "fix_notes": [
          "docs/FIX_NOTES.md"
        ],
        "manual": [
          "docs/WORKFLOW_SCHEMA.md"
        ]
      },
      "name": "集計・出力",
      "output": [
        "請求書一覧・明細・集計・検算結果のCSVとExcel"
      ],
      "refs": [
        "docs/WORKFLOW_SCHEMA.md",
        "scripts/03_export.py",
        "scripts/test_export.py"
      ],
      "role": "calculator",
      "status": "implemented",
      "task": "共通レコードを集計してCSVとExcelへ出力する",
      "verify": [
        {
          "check": "人の確認完了だけを集計・出力の必須ゲートにする",
          "gap": true
        },
        {
          "check": "生成されたCSVとExcelの内容整合性を独立した検査で保証する",
          "gap": true
        }
      ]
    },
    {
      "id": "ai-classification",
      "impl": [
        "scripts/ai_reprocess.py",
        "scripts/subscription_ai.py"
      ],
      "input": [
        "形式検証後にpayee補正される場合があるOCR JSON（補正直後の再検証はない）"
      ],
      "learning": {
        "cases": [],
        "fix_notes": [
          "docs/FIX_NOTES.md"
        ],
        "manual": [
          "docs/WORKFLOW_SCHEMA.md"
        ]
      },
      "name": "分類（現行は評価も兼ねる）",
      "output": [
        "書類種別・要確認・理由・金額整合性評価を含む現行結果"
      ],
      "refs": [
        "check:source-match",
        "docs/WORKFLOW_SCHEMA.md",
        "scripts/subscription_ai.py"
      ],
      "role": "judge",
      "status": "implemented",
      "task": "OCR JSONの書類種別を分類する",
      "verify": [
        {
          "check": "_validate(ROLE_CLASSIFICATION): 必須キー・needs_review・review_reasons・evaluationの型を検査する（書類種別の正しさまでは保証しない）",
          "impl": "scripts/subscription_ai.py"
        },
        {
          "check": "validate_pipeline_result: 保存済み統合結果を再開時に読み込む際、分類結果と統合結果・工程結果の一致を検査する",
          "impl": "scripts/subscription_ai.py"
        },
        {
          "check": "分類だけを依頼し、評価を独立した別工程にする",
          "gap": true
        },
        {
          "check": "初回実行の統合結果を保存・正規化へ渡す前に厳密に検証する",
          "gap": true
        }
      ]
    },
    {
      "id": "ai-field-recovery",
      "impl": [
        "scripts/ai_reprocess.py",
        "scripts/subscription_ai.py",
        "webapp/app.py"
      ],
      "input": [
        "元書類",
        "共通レコードと既存OCR結果"
      ],
      "learning": {
        "cases": [],
        "fix_notes": [
          "docs/FIX_NOTES.md"
        ],
        "manual": [
          "docs/WORKFLOW_SCHEMA.md"
        ]
      },
      "name": "AIによる項目回復",
      "output": [
        "人が採否を判断する項目候補（自動採用しない）"
      ],
      "refs": [
        "check:source-match",
        "scripts/ai_reprocess.py",
        "scripts/subscription_ai.py",
        "webapp/app.py"
      ],
      "role": "judge",
      "status": "implemented",
      "task": "欠落または疑わしい項目を元書類から根拠付きの候補として読み直す",
      "verify": [
        {
          "check": "_valid_recovery_candidate: 対象項目・値の型・根拠・信頼度を検査する",
          "impl": "scripts/ai_reprocess.py"
        },
        {
          "check": "_validate(ROLE_RECOVERY): 回復候補のスキーマを検査する",
          "impl": "scripts/subscription_ai.py"
        }
      ]
    },
    {
      "id": "ai-ocr",
      "impl": [
        "scripts/ai_reprocess.py",
        "scripts/subscription_ai.py"
      ],
      "input": [
        "AI OCR対象の元書類",
        "抽出品質",
        "既存のOCR学習ヒント"
      ],
      "learning": {
        "cases": [
          "case:private-workflow",
          "scripts/corrections_learning.py"
        ],
        "fix_notes": [
          "docs/FIX_NOTES.md"
        ],
        "manual": [
          "docs/WORKFLOW_SCHEMA.md"
        ]
      },
      "name": "AI OCR",
      "output": [
        "伝票単位のOCR JSON",
        "信頼度と警告"
      ],
      "refs": [
        "case:private-workflow",
        "check:source-match",
        "scripts/ai_reprocess.py",
        "scripts/subscription_ai.py"
      ],
      "role": "judge",
      "status": "implemented",
      "task": "元書類を伝票単位の構造化読取結果にする",
      "verify": [
        {
          "check": "OCR内容の正しさを元書類との照合なしで保証する",
          "gap": true
        },
        {
          "check": "_validate(ROLE_OCR): 補正前のOCR JSONの型・必須項目・document_indexの重複を検査する",
          "impl": "scripts/subscription_ai.py"
        },
        {
          "check": "_validate_ocr_payload: 補正前の伝票・ページ割当と空の読取結果を検査する",
          "impl": "scripts/subscription_ai.py"
        },
        {
          "check": "payee完全一致補正の直後、分類AIへ渡す前にOCR JSONを再検証する",
          "gap": true
        }
      ]
    },
    {
      "id": "ai-page-mapping",
      "impl": [
        "scripts/page_mapping_reprocess.py",
        "scripts/subscription_ai.py",
        "webapp/app.py"
      ],
      "input": [
        "既存伝票のdocument_index",
        "複数ページの元書類"
      ],
      "learning": {
        "cases": [],
        "fix_notes": [
          "docs/FIX_NOTES.md"
        ],
        "manual": [
          "docs/WORKFLOW_SCHEMA.md"
        ]
      },
      "name": "AIによるページ割当",
      "output": [
        "ページ割当候補と信頼度・警告"
      ],
      "refs": [
        "check:source-match",
        "scripts/page_mapping_reprocess.py",
        "scripts/subscription_ai.py",
        "webapp/app.py"
      ],
      "role": "judge",
      "status": "implemented",
      "task": "既存の複数ページ伝票にページ範囲を割り当てる",
      "verify": [
        {
          "check": "_validate_mapping_for_records: 既存伝票数・document_index・ページの重複と漏れを検査する",
          "impl": "scripts/page_mapping_reprocess.py"
        },
        {
          "check": "_validate_page_mapping_payload: ページ割当AIのJSON形式を検査する",
          "impl": "scripts/subscription_ai.py"
        }
      ]
    },
    {
      "id": "ai-vendor-suggestion",
      "impl": [
        "scripts/subscription_ai.py",
        "webapp/app.py"
      ],
      "input": [
        "人の外部送信確認",
        "取引先表記と統合可能な候補"
      ],
      "learning": {
        "cases": [],
        "fix_notes": [
          "docs/FIX_NOTES.md"
        ],
        "manual": [
          "docs/WORKFLOW_SCHEMA.md"
        ]
      },
      "name": "AIによる取引先提案",
      "output": [
        "人が採否を判断する取引先提案"
      ],
      "refs": [
        "scripts/subscription_ai.py",
        "scripts/vendor_master.py",
        "webapp/app.py"
      ],
      "role": "judge",
      "status": "implemented",
      "task": "取引先の新規登録・修正登録・既存への統合を提案する",
      "verify": [
        {
          "check": "do_POST: 取引先提案APIで外部送信確認とAIクライアントの存在を検査する",
          "impl": "webapp/app.py"
        },
        {
          "check": "validate_vendor_suggestion: action・信頼度・統合先の候補所属と自己統合禁止を検査する",
          "impl": "scripts/subscription_ai.py"
        }
      ]
    },
    {
      "id": "classification-only",
      "impl": [],
      "input": [
        "伝票単位の共通レコード"
      ],
      "learning": {
        "cases": [],
        "fix_notes": [
          "docs/FIX_NOTES.md"
        ],
        "manual": [
          "docs/WORKFLOW_SCHEMA.md"
        ]
      },
      "name": "分類だけの独立工程",
      "output": [
        "独立した書類種別の分類結果"
      ],
      "refs": [
        "check:source-match",
        "docs/WORKFLOW_SCHEMA.md"
      ],
      "role": "judge",
      "status": "planned",
      "task": "正規化済みの共通レコードを書類種別だけに分類する",
      "verify": [
        {
          "check": "共通レコードを受け取り、分類だけを返す独立したAI工程を検証する",
          "gap": true
        }
      ]
    },
    {
      "id": "human-reread-request",
      "impl": [
        "scripts/ai_reprocess.py",
        "webapp/app.py"
      ],
      "input": [
        "人が見直す共通レコードと元書類",
        "外部送信の確認"
      ],
      "learning": {
        "cases": [],
        "fix_notes": [
          "docs/FIX_NOTES.md"
        ],
        "manual": [
          "docs/WORKFLOW_SCHEMA.md"
        ]
      },
      "name": "AI再読取の依頼・実行",
      "output": [
        "キューへの依頼または再読取実行"
      ],
      "refs": [
        "scripts/ai_reprocess.py",
        "scripts/page_mapping_reprocess.py",
        "webapp/app.py"
      ],
      "role": "human",
      "status": "implemented",
      "task": "対象と外部送信を確認してAIの再読取を依頼する",
      "verify": [
        {
          "check": "_safe_source_file: 指定した元書類の参照パスを検査する",
          "impl": "webapp/app.py"
        },
        {
          "check": "do_POST: AI実行・回復APIでmode・対象・外部送信確認を検査し、再読取キューの重複を拒否する",
          "impl": "webapp/app.py"
        }
      ]
    },
    {
      "id": "human-review",
      "impl": [
        "scripts/ai_reprocess.py",
        "webapp/app.py"
      ],
      "input": [
        "元書類",
        "共通レコードと要確認理由"
      ],
      "learning": {
        "cases": [
          "case:private-workflow",
          "scripts/corrections_learning.py"
        ],
        "fix_notes": [
          "docs/FIX_NOTES.md"
        ],
        "manual": [
          "docs/FIX_NOTES.md",
          "docs/WORKFLOW_SCHEMA.md"
        ]
      },
      "name": "元書類と照合",
      "output": [
        "確認状態・訂正・チェック結果・直しメモ"
      ],
      "refs": [
        "check:duplicate-check",
        "check:source-match",
        "docs/FIX_NOTES.md",
        "docs/WORKFLOW_SCHEMA.md",
        "scripts/ai_reprocess.py",
        "webapp/app.py"
      ],
      "role": "human",
      "status": "implemented",
      "task": "元書類と共通レコードを照合して確認結果を保存する",
      "verify": [
        {
          "check": "_normalize_review_checksと確認保存処理: 必須チェック未完了のconfirmed保存を拒否する",
          "impl": "webapp/app.py"
        },
        {
          "check": "_validate_page_assignment: 伝票のページ割当・除外の確認を検査する",
          "impl": "webapp/app.py"
        },
        {
          "check": "note_confirms_record: review_checks.source_match・duplicate_checkの必要条件を評価する",
          "impl": "scripts/ai_reprocess.py"
        },
        {
          "check": "人が行った目視照合の内容の正しさを自動で保証する",
          "gap": true
        }
      ]
    },
    {
      "id": "normalize",
      "impl": [
        "scripts/02_normalize.py",
        "scripts/rebuild.py"
      ],
      "input": [
        "人の訂正と伝票分割の判断",
        "抽出テキストまたはAI読取結果"
      ],
      "learning": {
        "cases": [],
        "fix_notes": [
          "docs/FIX_NOTES.md"
        ],
        "manual": [
          "docs/WORKFLOW_SCHEMA.md"
        ]
      },
      "name": "共通表への整理",
      "output": [
        "伝票単位の共通レコード"
      ],
      "refs": [
        "docs/WORKFLOW_SCHEMA.md",
        "scripts/data_contracts.py",
        "scripts/rebuild.py",
        "webapp/app.py"
      ],
      "role": "calculator",
      "status": "implemented",
      "task": "読取結果を伝票単位の共通レコードに正規化する",
      "verify": [
        {
          "check": "_review_reasons: 必須項目不足・AI読取の衝突・ページ割当不足を要確認にする",
          "impl": "scripts/02_normalize.py"
        },
        {
          "check": "共通レコードの全項目を厳密なスキーマで検証する",
          "gap": true
        }
      ]
    },
    {
      "id": "ocr-route",
      "impl": [
        "scripts/ai_reprocess.py",
        "scripts/subscription_ai.py"
      ],
      "input": [
        "抽出テキストの品質",
        "登録済み元書類"
      ],
      "learning": {
        "cases": [],
        "fix_notes": [
          "docs/FIX_NOTES.md"
        ],
        "manual": [
          "docs/WORKFLOW_SCHEMA.md"
        ]
      },
      "name": "AIによるOCR方式選択",
      "output": [
        "AI方式選択結果（バッチ複数ページではai_ocrへ上書き）"
      ],
      "refs": [
        "docs/WORKFLOW_SCHEMA.md",
        "scripts/ai_reprocess.py",
        "scripts/subscription_ai.py"
      ],
      "role": "sorter",
      "status": "implemented",
      "task": "program・ai_ocr・manual_reviewの固定選択肢から方式を選ぶ",
      "verify": [
        {
          "check": "_validate(ROLE_SELECTION): routeの選択肢とreasonsの型を検査する",
          "impl": "scripts/subscription_ai.py"
        }
      ]
    },
    {
      "id": "program-checks",
      "impl": [
        "scripts/04_validate.py",
        "scripts/rebuild.py"
      ],
      "input": [
        "伝票単位の共通レコード"
      ],
      "learning": {
        "cases": [],
        "fix_notes": [
          "docs/FIX_NOTES.md"
        ],
        "manual": [
          "docs/WORKFLOW_SCHEMA.md"
        ]
      },
      "name": "プログラム検算",
      "output": [
        "検算結果と要確認理由"
      ],
      "refs": [
        "check:source-match",
        "docs/WORKFLOW_SCHEMA.md",
        "scripts/04_validate.py",
        "scripts/05_benchmark.py"
      ],
      "role": "calculator",
      "status": "implemented",
      "task": "正規化済みレコードの数値と必須項目の整合性を検査する",
      "verify": [
        {
          "check": "_carry_forward_check: 前残・入金・相殺・当月額・繰越を検算する",
          "impl": "scripts/04_validate.py"
        },
        {
          "check": "_line_item_check: 明細の数量・単位・単価・合計を検算する",
          "impl": "scripts/04_validate.py"
        },
        {
          "check": "_required_check: 単独請求書・納品書のinvoice_date・payee・totalを検査する",
          "impl": "scripts/04_validate.py"
        },
        {
          "check": "_tax_check: 税率別税額・税抜小計・税合計を検算する",
          "impl": "scripts/04_validate.py"
        },
        {
          "check": "_total_check: 小計と税額から総額を検算する",
          "impl": "scripts/04_validate.py"
        },
        {
          "check": "validate_record: 必要に応じbenchmarkの外れ値を検査する（rebuild経路はbenchmarkを渡さない）",
          "impl": "scripts/04_validate.py"
        }
      ]
    },
    {
      "id": "register",
      "impl": [
        "scripts/file_transfers.py",
        "webapp/app.py"
      ],
      "input": [
        "利用者が選んだ元書類"
      ],
      "learning": {
        "cases": [],
        "fix_notes": [
          "docs/FIX_NOTES.md"
        ],
        "manual": [
          "docs/RUNNING_LOCALLY.md"
        ]
      },
      "name": "元書類の登録",
      "output": [
        "登録済み元書類"
      ],
      "refs": [
        "docs/RUNNING_LOCALLY.md",
        "docs/WORKFLOW_SCHEMA.md"
      ],
      "role": "human",
      "status": "implemented",
      "task": "整理する元書類を登録する",
      "verify": [
        {
          "check": "TransferService.import_file: 拡張子・内容署名・PDFページ数・画像の復号を検査する",
          "impl": "scripts/file_transfers.py"
        },
        {
          "check": "_safe_source_file: 元書類の参照を安全な相対パスに制限する",
          "impl": "webapp/app.py"
        }
      ]
    },
    {
      "id": "text-extract",
      "impl": [
        "scripts/01_extract.py"
      ],
      "input": [
        "テキスト層の有無を調べる登録済み元書類"
      ],
      "learning": {
        "cases": [],
        "fix_notes": [
          "docs/FIX_NOTES.md"
        ],
        "manual": [
          "docs/WORKFLOW_SCHEMA.md"
        ]
      },
      "name": "文字抽出",
      "output": [
        "ページ数",
        "抽出テキスト（テキスト層がなければ空）"
      ],
      "refs": [
        "check:source-match",
        "docs/WORKFLOW_SCHEMA.md",
        "scripts/01_extract.py"
      ],
      "role": "calculator",
      "status": "implemented",
      "task": "PDFのテキスト層を抽出する",
      "verify": [
        {
          "check": "元書類と文字抽出結果の完全一致を自動で保証する",
          "gap": true
        }
      ]
    },
    {
      "id": "text-quality",
      "impl": [
        "scripts/01_extract.py"
      ],
      "input": [
        "抽出テキスト",
        "画像入力の種別"
      ],
      "learning": {
        "cases": [],
        "fix_notes": [
          "docs/FIX_NOTES.md"
        ],
        "manual": [
          "docs/WORKFLOW_SCHEMA.md"
        ]
      },
      "name": "抽出品質の判定",
      "output": [
        "プログラム読取の可否と品質理由"
      ],
      "refs": [
        "docs/WORKFLOW_SCHEMA.md",
        "scripts/01_extract.py"
      ],
      "role": "calculator",
      "status": "implemented",
      "task": "抽出した文字の品質からプログラム読取の可否を判定する",
      "verify": [
        {
          "check": "detect_text_quality: 文字の量・読める文字の割合・文字化けの兆候を検査する",
          "impl": "scripts/01_extract.py"
        }
      ]
    }
  ],
  "title": "請求書整理",
  "version": 1
};
  if (typeof module === "object" && module.exports) module.exports = definition;
  else root.SeikyuWorkflowDefinition = definition;
})(typeof globalThis === "object" ? globalThis : this);
