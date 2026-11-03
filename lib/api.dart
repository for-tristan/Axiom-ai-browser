import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;

/// Backend base URL. Override at build time:
///   flutter run --dart-define=AXIOM_API=http://192.168.1.10:8000
class ApiConfig {
  static const _override = String.fromEnvironment('AXIOM_API');

  static String get baseUrl {
    if (_override.isNotEmpty) return _override;
    // The Android emulator reaches the host machine via 10.0.2.2.
    if (!kIsWeb && Platform.isAndroid) return 'http://10.0.2.2:8000';
    return 'http://localhost:8000';
  }
}

class Citation {
  final int number;
  final String title;
  final String url;
  const Citation({required this.number, required this.title, required this.url});

  factory Citation.fromJson(Map<String, dynamic> j) => Citation(
        number: (j['number'] as num).toInt(),
        title: j['title'] as String? ?? '',
        url: j['url'] as String? ?? '',
      );
}

class SourcePage {
  final String title;
  final String url;
  final String content;
  const SourcePage({required this.title, required this.url, required this.content});

  factory SourcePage.fromJson(Map<String, dynamic> j) => SourcePage(
        title: j['title'] as String? ?? '',
        url: j['url'] as String? ?? '',
        content: j['content'] as String? ?? '',
      );
}

/// Response of POST /search/answer.
class AnswerResult {
  final String answer;
  final List<Citation> citations;
  final List<SourcePage> sources;
  const AnswerResult({
    required this.answer,
    required this.citations,
    required this.sources,
  });

  factory AnswerResult.fromJson(Map<String, dynamic> j) => AnswerResult(
        answer: j['answer'] as String? ?? '',
        citations: (j['citations'] as List? ?? [])
            .map((e) => Citation.fromJson(e as Map<String, dynamic>))
            .toList(),
        sources: (j['sources'] as List? ?? [])
            .map((e) => SourcePage.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

class AxiomApi {
  static Future<AnswerResult> searchAnswer(
    String question, {
    int maxResults = 5,
    bool fetchContent = true,
  }) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/search/answer');
    try {
      final res = await http
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'question': question,
              'max_results': maxResults,
              'fetch_content': fetchContent,
            }),
          )
          .timeout(const Duration(seconds: 90));

      if (res.statusCode != 200) {
        String detail = 'Server error (${res.statusCode})';
        try {
          final body = jsonDecode(utf8.decode(res.bodyBytes));
          if (body is Map && body['detail'] != null) {
            detail = body['detail'].toString();
          }
        } catch (_) {}
        throw ApiException(detail);
      }
      return AnswerResult.fromJson(
          jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>);
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException(
          'Could not reach the Axiom backend at ${ApiConfig.baseUrl}. '
          'Make sure it is running.');
    }
  }
}
