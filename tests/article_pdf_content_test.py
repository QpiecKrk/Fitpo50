import sys,unittest,tempfile,subprocess
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from generate_article_pdf import generate_pdf
from PIL import Image

class PdfContentTest(unittest.TestCase):
 def test_faq_heading_stays_with_first_question(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);page=root/'article.html';pdf=root/'article.pdf'
   paragraphs=''.join(f'<p>Akapit testowy numer {i} zawiera wystarczająco dużo słów, aby zająć przewidywalne miejsce w dokumencie PDF i sprawdzić podział strony.</p>' for i in range(14))
   page.write_text(f'<h1 class="article-header__title">Test układu FAQ</h1><article class="article-content">{paragraphs}<section class="faq-list"><h2>Najczęściej zadawane pytania</h2><article class="faq-item"><h3>Pierwsze pytanie kontrolne?</h3><p>Pierwsza odpowiedź kontrolna powinna pozostać obok nagłówka.</p></article></section></article>')
   generate_pdf(page,pdf,'https://fitpo50.pl/article.html')
   pages=subprocess.check_output(['pdftotext','-layout',str(pdf),'-'],text=True).split('\f')
   heading_page=next(i for i,text in enumerate(pages) if 'Najczęściej zadawane pytania' in text)
   question_page=next(i for i,text in enumerate(pages) if 'Pierwsze pytanie kontrolne' in text)
   self.assertEqual(heading_page,question_page)

 def test_section_heading_stays_with_following_image(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);page=root/'article.html';pdf=root/'article.pdf'
   Image.new('RGB',(1200,675),'blue').save(root/'section.jpg')
   paragraphs=''.join(f'<p>Akapit testowy numer {i} zawiera wystarczająco dużo słów, aby zająć przewidywalne miejsce w dokumencie PDF i sprawdzić podział strony.</p>' for i in range(14))
   page.write_text(f'<h1 class="article-header__title">Test ilustracji</h1><article class="article-content">{paragraphs}<h2>Sekcja z ilustracją?</h2><figure><img src="section.jpg"><figcaption>Konkretny podpis obrazu kontrolnego w sekcji.</figcaption></figure><p>Treść sekcji.</p></article>')
   generate_pdf(page,pdf,'https://fitpo50.pl/article.html')
   pages=subprocess.check_output(['pdftotext','-layout',str(pdf),'-'],text=True).split('\f')
   heading_page=next(i for i,text in enumerate(pages) if 'Sekcja z ilustracją?' in text) + 1
   image_lines=subprocess.check_output(['pdfimages','-list',str(pdf)],text=True).splitlines()[2:]
   image_page=int(next(line.split()[0] for line in image_lines if line.split()))
   self.assertEqual(heading_page,image_page)

 def test_section_heading_stays_with_opening_paragraph(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);page=root/'article.html';pdf=root/'article.pdf'
   filler=''.join(f'<p>Akapit wypełniający numer {i} zajmuje przewidywalne miejsce i ustawia kolejny nagłówek blisko dolnej krawędzi strony.</p>' for i in range(16))
   opening='POCZĄTEK SEKCJI Ten akapit wyjaśnia sedno zagadnienia i jego pierwsze zdania muszą pozostać na tej samej stronie co nagłówek.'
   page.write_text(f'<h1 class="article-header__title">Test nagłówka</h1><article class="article-content">{filler}<h2>Dlaczego ten wynik wymaga ostrożnej interpretacji?</h2><p>{opening}</p></article>')
   generate_pdf(page,pdf,'https://fitpo50.pl/article.html')
   pages=subprocess.check_output(['pdftotext','-layout',str(pdf),'-'],text=True).split('\f')
   heading_page=next(i for i,text in enumerate(pages) if 'Dlaczego ten wynik' in text)
   opening_page=next(i for i,text in enumerate(pages) if 'POCZĄTEK SEKCJI' in text)
   self.assertEqual(heading_page,opening_page)

 def test_short_bibliography_uses_remaining_page_space(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);page=root/'article.html';pdf=root/'article.pdf'
   page.write_text('<h1 class="article-header__title">Krótki artykuł</h1><article class="article-content"><p>Krótka treść główna.</p><h2 id="zrodla">Źródła</h2><ol><li>Pierwsza publikacja naukowa.</li></ol><div class="medical-disclaimer">Krótka informacja prawna.</div></article>')
   generate_pdf(page,pdf,'https://fitpo50.pl/article.html')
   info=subprocess.check_output(['pdfinfo',str(pdf)],text=True)
   self.assertIn('Pages:           1',info)

 def test_short_blockquote_is_not_split_between_pages(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);page=root/'article.html';pdf=root/'article.pdf'
   paragraphs=''.join(f'<p>Akapit kontrolny numer {i} zawiera dużo przewidywalnych słów do sprawdzenia granicy strony dokumentu i zachowania całego krótkiego cytatu razem.</p>' for i in range(18))
   quote='POCZĄTEK CYTATU Funkcja może wracać dzięki odrostowi, plastyczności, kompensacji i treningowi; tych mechanizmów nie wolno wrzucać do jednego hasła. KONIEC CYTATU.'
   page.write_text(f'<h1 class="article-header__title">Test cytatu</h1><article class="article-content">{paragraphs}<blockquote><p>{quote}</p></blockquote></article>')
   generate_pdf(page,pdf,'https://fitpo50.pl/article.html')
   pages=subprocess.check_output(['pdftotext','-layout',str(pdf),'-'],text=True).split('\f')
   start_page=next(i for i,text in enumerate(pages) if 'POCZĄTEK CYTATU' in text)
   end_page=next(i for i,text in enumerate(pages) if 'KONIEC CYTATU' in text)
   self.assertEqual(start_page,end_page)

 def test_article_quote_with_inline_link_remains_one_text_block(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);page=root/'article.html';pdf=root/'article.pdf'
   quote='"Mam 50+ lat, zaczynam od zera, chcę ćwiczyć siłowo. Pokaż mi pięć ćwiczeń i <a href="plan.html">jak nie skrzywdzić kolan</a>."'
   page.write_text(f'<h1 class="article-header__title">Test cytatu z linkiem</h1><article class="article-content"><div class="article-quote">{quote}</div></article>')
   generate_pdf(page,pdf,'https://fitpo50.pl/article.html')
   text=subprocess.check_output(['pdftotext','-layout',str(pdf),'-'],text=True)
   self.assertIn('Pokaż mi pięć ćwiczeń i jak nie skrzywdzić kolan."', ' '.join(text.split()))
   self.assertNotRegex(text, r'jak nie skrzywdzić kolan\s*\n\s*\.\s*"')

 def test_short_paragraph_does_not_leave_an_orphan_line(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);page=root/'article.html';pdf=root/'article.pdf'
   filler='<p>Akapit wypełniający zajmuje przewidywalne miejsce w dokumencie testowym.</p>' * 25
   target='POCZĄTEK AKAPITU ' + ('Treść kontrolna zachowuje znaczenie i nie może zostawić samotnej końcówki na następnej stronie. ' * 3) + 'KONIEC AKAPITU'
   page.write_text(f'<h1 class="article-header__title">Test akapitu</h1><article class="article-content">{filler}<p>{target}</p></article>')
   generate_pdf(page,pdf,'https://fitpo50.pl/article.html')
   pages=subprocess.check_output(['pdftotext','-layout',str(pdf),'-'],text=True).split('\f')
   start_page=next(i for i,text in enumerate(pages) if 'POCZĄTEK AKAPITU' in text)
   end_page=next(i for i,text in enumerate(pages) if 'KONIEC AKAPITU' in text)
   self.assertEqual(start_page,end_page)

 def test_preserves_quick_answer_outside_article_and_root_text(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);page=root/'article.html';pdf=root/'article.pdf'
   page.write_text('<h1 class="article-header__title">Próba</h1><section id="quick-answer"><p>ODPOWIEDŹ POZA ARTYKUŁEM</p></section><article class="article-content">TEKST BEZ KONTENERA<p>Akapit.</p></article>')
   generate_pdf(page,pdf,'https://fitpo50.pl/article.html')
   text=subprocess.check_output(['pdftotext',str(pdf),'-'],text=True)
   self.assertEqual(text.count('ODPOWIEDŹ POZA ARTYKUŁEM'),1)
   self.assertIn('TEKST BEZ KONTENERA',text)

 def test_preserves_unwrapped_images_and_direct_container_text(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);Image.new('RGB',(900,500),'blue').save(root/'image.jpg')
   page=root/'article.html';pdf=root/'article.pdf'
   page.write_text('<h1 class="article-header__title">Próba treści</h1><article class="article-content"><blockquote>CYTAT BEZ AKAPITU</blockquote><picture><img src="image.jpg"></picture><section class="share-article-section"><h2>Udostępnij artykuł</h2><p>Facebook</p></section><h2 id="zrodla">Źródła</h2><ol><li>Pierwsza publikacja naukowa.</li><li>Druga publikacja naukowa.</li></ol><div class="medical-disclaimer">OSTRZEŻENIE BEZ AKAPITU</div></article>')
   generate_pdf(page,pdf,'https://fitpo50.pl/article.html')
   text=subprocess.check_output(['pdftotext',str(pdf),'-'],text=True)
   self.assertIn('CYTAT BEZ AKAPITU',text)
   self.assertIn('OSTRZEŻENIE BEZ AKAPITU',text)
   self.assertNotIn('Facebook',text)
   images=subprocess.check_output(['pdfimages','-list',str(pdf)],text=True)
   self.assertIn('image', '\n'.join(images.splitlines()[2:]))

 def test_table_with_nested_inline_markup_renders(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);page=root/'article.html';pdf=root/'article.pdf'
   page.write_text('<h1 class="article-header__title">Tabela</h1><article class="article-content"><table><caption>Porównanie</caption><thead><tr><th>Badanie</th><th>Wynik</th></tr></thead><tbody><tr><td><strong>Próba kliniczna</strong> (2026)</td><td>Treść komórki</td></tr></tbody></table></article>')
   generate_pdf(page,pdf,'https://fitpo50.pl/article.html')
   text=subprocess.check_output(['pdftotext',str(pdf),'-'],text=True)
   self.assertIn('Próba kliniczna',text)
   self.assertIn('Treść komórki',text)

 def test_table_cells_do_not_justify_words_across_the_column(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);page=root/'article.html';pdf=root/'article.pdf'
   page.write_text('<h1 class="article-header__title">Tabela FIB-4</h1><article class="article-content"><p><div class="article-table-wrap"><table><caption>Interpretacja</caption><thead><tr><th>Wynik</th><th>Co to oznacza</th><th>Co dalej</th></tr></thead><tbody><tr><th>poniżej 1,3</th><td>niskie ryzyko zaawansowanego włóknienia</td><td>ponowna ocena co 1–3 lata</td></tr><tr><th>1,3–2,67</th><td>wynik pośredni, niejednoznaczny</td><td>elastografia albo rok intensywnej zmiany stylu życia i ponowny FIB-4</td></tr><tr><th>powyżej 2,67</th><td>podwyższone ryzyko zaawansowanego włóknienia</td><td>skierowanie do hepatologa</td></tr></tbody></table></div></p></article>')
   generate_pdf(page,pdf,'https://fitpo50.pl/article.html')
   text=subprocess.check_output(['pdftotext','-layout',str(pdf),'-'],text=True)
   self.assertNotRegex(text, r'podwyższone\s{3,}ryzyko')
if __name__=='__main__':unittest.main()
