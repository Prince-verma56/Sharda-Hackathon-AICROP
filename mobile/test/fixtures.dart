/// Response fixtures with the exact shapes the backend returns (see server/cropai/report.ts and
/// app/api/v1/farmer/*). Used ONLY for parsing and widget tests — they are not model output and
/// are never used to claim AI integration; the acceptance test uses the real backend and model.
library;

Map<String, Object?> sampleReportJson({String id = 'cmtestreport0001'}) => {
      'id': id,
      'createdAt': '2026-11-14T06:48:10.000Z',
      'language': 'en',
      'status': 'COMPLETED',
      'image': {'url': '/api/v1/images/diagnoses/$id', 'width': 1600, 'height': 1200, 'expiresAt': null},
      'crop': {'id': 'tomato', 'name': 'Tomato', 'imageUrl': '/images/crops/tomato.jpg', 'selected': {'id': 'tomato', 'name': 'Tomato'}, 'source': 'user'},
      'result': {
        'label': 'tomato::Late blight',
        'condition': 'Late blight',
        'isHealthy': false,
        'score': 0.82,
        'scorePercent': 82,
        'margin': 0.7,
        'scoreType': 'crop_conditioned_softmax',
        'screeningStatus': 'needs_attention',
        'isLaboratoryConfirmed': false,
        'photoQuality': 'ok',
        'qualityWarnings': <Object?>[],
        'advisories': [
          {'code': 'WEAK_CLASS_UPSTREAM', 'label': 'Model is less reliable for this condition'},
        ],
        'uncertain': true,
        'severity': null,
      },
      'model': {'name': 'AgriSmart India', 'version': 'india-model-v1', 'inferenceMs': 410},
      'predictions': [
        {'rank': 2, 'label': 'tomato::Early blight', 'crop': 'tomato', 'condition': 'Early blight', 'score': 0.12, 'isHealthy': false},
        {'rank': 1, 'label': 'tomato::Late blight', 'crop': 'tomato', 'condition': 'Late blight', 'score': 0.82, 'isHealthy': false},
        {'rank': 3, 'label': 'tomato::Healthy', 'crop': 'tomato', 'condition': 'Healthy', 'score': 0.04, 'isHealthy': true},
      ],
      'explanation': {
        'source': 'approved_guidance',
        'summary': 'Signs similar to late blight were found.',
        'conditionExplanation': 'Late blight is a disease that spreads in cool, wet weather.',
        'possibleCauses': ['Cool, wet weather'],
        'sources': [
          {'title': 'ICAR guidance', 'url': 'https://icar.org.in/'},
        ],
      },
      'actions': [
        {'step': 1, 'kind': 'inspect', 'text': 'Check the underside of leaves.'},
        {'step': 2, 'kind': 'prevent', 'text': 'Remove badly affected leaves.'},
        {'step': 3, 'kind': 'expert', 'text': 'Ask your KVK before spraying.'},
      ],
      'lookFor': {'kind': 'approved_symptoms', 'items': ['Dark water-soaked spots']},
      'guidance': {'id': 'k1', 'title': 'Late blight', 'sourceUrl': 'https://icar.org.in/', 'sourceOrganisation': 'ICAR', 'lastReviewedAt': null},
      'references': [
        {'kind': 'condition', 'label': 'Late blight', 'imageUrl': '/api/v1/images/knowledge/k1', 'credit': 'ICAR'},
        {'kind': 'healthy', 'label': 'Healthy plant', 'imageUrl': null, 'credit': null},
      ],
      'weather': {
        'provider': 'open-meteo',
        'observedAt': '2026-11-14T06:00:00.000Z',
        'fetchedAt': '2026-11-14T06:48:00.000Z',
        'temperatureC': 21.5,
        'humidityPct': 88,
        'rainLast24hMm': 4.2,
        'rainLast72hMm': 11,
        'forecast': [
          {'date': '2026-11-15', 'maxC': 24, 'minC': 15, 'rainMm': 2.1},
          {'date': '2026-11-16', 'maxC': 25, 'minC': 16, 'rainMm': 0},
        ],
        'note': 'Context only — not a disease-risk prediction.',
      },
      'fieldNotes': {
        'items': [
          {'key': 'cropStage', 'label': 'Crop stage', 'value': 'Flowering'},
        ],
        'note': 'Spots after rain',
        'capturedAt': '2026-11-14T12:18:10+05:30',
        'timeZone': 'IST',
        'location': null,
      },
      'review': {'status': 'UNREVIEWED', 'requestedAt': null, 'latest': null},
      'feedback': null,
      'history': [
        {'id': 'cmold00000000001', 'createdAt': '2026-11-01T06:00:00.000Z', 'condition': 'Healthy', 'score': 0.9, 'isHealthy': true, 'current': false},
        {'id': id, 'createdAt': '2026-11-14T06:48:10.000Z', 'condition': 'Late blight', 'score': 0.82, 'isHealthy': false, 'current': true},
      ],
      'heatmap': {'available': false, 'reason': 'The AgriSmart service does not provide a validated explanation map.'},
      'speech': {'text': 'Your tomato photo shows signs like late blight.', 'locale': 'en-IN'},
      'shareText': 'Tomato: Late blight (model score 82%)',
      'askMitra': ['What does this result mean?', 'What should I do first?'],
      'disclaimer': 'This is an AI screening, not a lab test.',
    };

Map<String, Object?> sampleCatalogueJson() => {
      'modelVersion': 'india-model-v1',
      'cropCount': 2,
      'classCount': 5,
      'autoCrop': true,
      'crops': [
        {'id': 'potato', 'name': {'en': 'Potato', 'hi': 'आलू'}, 'imageUrl': '/images/crops/potato.jpg', 'classCount': 2, 'conditions': <Object?>[]},
        {'id': 'tomato', 'name': {'en': 'Tomato', 'hi': 'टमाटर'}, 'imageUrl': '/images/crops/tomato.jpg', 'classCount': 3, 'conditions': <Object?>[]},
      ],
      'mine': ['tomato'],
      'popular': ['potato'],
      'samples': <Object?>[],
      'fieldDetails': {
        'labels': {
          'cropStage': {'en': 'Crop stage', 'hi': 'फसल की अवस्था'},
          'parts': {'en': 'Affected parts', 'hi': 'कौन-सा हिस्सा'},
        },
        'options': {
          'cropStage': [
            {'id': 'seedling', 'en': 'Seedling', 'hi': 'पौध'},
            {'id': 'flowering', 'en': 'Flowering', 'hi': 'फूल'},
          ],
          'parts': [
            {'id': 'leaves', 'en': 'Leaves', 'hi': 'पत्ते'},
            {'id': 'fruit', 'en': 'Fruit', 'hi': 'फल'},
          ],
        },
        'multiple': ['parts'],
      },
    };

Map<String, Object?> sampleHomeJson() => {
      'language': 'en',
      'preferredName': 'Asha',
      'onboarded': true,
      'notice': null,
      'unreadNotifications': 2,
      'checks': 3,
      'latest': {
        'id': 'cmtestreport0001',
        'createdAt': '2026-11-14T06:48:10.000Z',
        'crop': {'id': 'tomato', 'name': 'Tomato', 'imageUrl': null},
        'condition': 'Late blight',
        'isHealthy': false,
        'score': 0.82,
        'thumbnailUrl': null,
      },
      'crops': [
        {'id': 'tomato', 'name': 'Tomato', 'imageUrl': null},
      ],
      'farm': {'label': 'Rampur', 'hasLocation': true},
      'weather': null,
      'weatherStatus': 'unavailable',
      'videos': <Object?>[],
    };
