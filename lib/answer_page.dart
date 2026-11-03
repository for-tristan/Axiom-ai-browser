import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'theme.dart';

/// Shows the AI-generated answer (POST /search/answer) with its citations
/// and the source pages that were used.
class AnswerPage extends StatefulWidget {
  final String question;
  const AnswerPage({super.key, required this.question});

  @override
  State<AnswerPage> createState() => _AnswerPageState();
}

class _AnswerPageState extends State<AnswerPage> {
  late Future<AnswerResult> _future;

  @override
  void initState() {
    super.initState();
    _future = AxiomApi.searchAnswer(widget.question);
  }

  void _retry() =>
      setState(() => _future = AxiomApi.searchAnswer(widget.question));

  Future<void> _open(String url) async {
    if (url.isEmpty) return;
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment(-0.34, -1),
            end: Alignment(0.34, 1),
            colors: [AxiomColors.bgTop, AxiomColors.bgBottom],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _header(context),
              Expanded(
                child: FutureBuilder<AnswerResult>(
                  future: _future,
                  builder: (context, snap) {
                    if (snap.connectionState != ConnectionState.done) {
                      return _loading();
                    }
                    if (snap.hasError) return _error(snap.error.toString());
                    return _content(snap.data!);
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 8),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.22),
        border: Border(bottom: BorderSide(color: AxiomColors.border)),
      ),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Back',
            onPressed: () => Navigator.of(context).pop(),
            icon: const FaIcon(FontAwesomeIcons.arrowLeft, size: 16),
          ),
          const FaIcon(FontAwesomeIcons.wandMagicSparkles,
              size: 15, color: AxiomColors.accent),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              widget.question,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }

  Widget _loading() => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: AxiomColors.accent),
            const SizedBox(height: 16),
            Text('Searching the web and writing an answer...',
                style: TextStyle(color: AxiomColors.textMuted)),
          ],
        ),
      );

  Widget _error(String message) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const FaIcon(FontAwesomeIcons.triangleExclamation,
                  size: 28, color: AxiomColors.danger),
              const SizedBox(height: 14),
              Text(message,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AxiomColors.textMuted)),
              const SizedBox(height: 18),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: AxiomColors.accent,
                  foregroundColor: AxiomColors.bgTop,
                ),
                onPressed: _retry,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );

  Widget _card({required Widget child, VoidCallback? onTap}) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Material(
          color: AxiomColors.surface,
          shape: RoundedRectangleBorder(
            side: BorderSide(color: AxiomColors.border),
            borderRadius: BorderRadius.circular(AxiomColors.radius),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(AxiomColors.radius),
            onTap: onTap,
            child: Padding(padding: const EdgeInsets.all(14), child: child),
          ),
        ),
      );

  Widget _content(AnswerResult r) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760),
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _card(
              child: SelectableText(
                r.answer.isEmpty ? 'No answer was generated.' : r.answer,
                style: const TextStyle(fontSize: 16, height: 1.55),
              ),
            ),
            if (r.citations.isNotEmpty) ...[
              const SizedBox(height: 12),
              _sectionTitle('Sources'),
              for (final c in r.citations)
                _card(
                  onTap: () => _open(c.url),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 12,
                        backgroundColor: AxiomColors.accent,
                        child: Text('${c.number}',
                            style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AxiomColors.bgTop)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(c.title,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 14, fontWeight: FontWeight.w600)),
                            const SizedBox(height: 2),
                            Text(c.url,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                    fontSize: 12, color: AxiomColors.textMuted)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
            ] else if (r.sources.isNotEmpty) ...[
              const SizedBox(height: 12),
              _sectionTitle('Pages used'),
              for (final s in r.sources)
                _card(
                  onTap: () => _open(s.url),
                  child: Text(s.title.isEmpty ? s.url : s.title,
                      style: const TextStyle(fontSize: 14)),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 8, left: 2),
        child: Text(t,
            style: TextStyle(
                fontSize: 13,
                letterSpacing: 0.5,
                color: AxiomColors.textMuted,
                fontWeight: FontWeight.w600)),
      );
}
