(function(){
'use strict';
type Units={albuminUnit:string;creatinineUnit:string;glucoseUnit:string;crpUnit:string};
type Values={age:number;albumin:number;creatinine:number;glucose:number;crp:number;lymphocyte:number;mcv:number;rdw:number;alp:number;wbc:number};
const form=document.querySelector<HTMLFormElement>('[data-pheno-form]');
const errorNode=document.querySelector<HTMLElement>('[data-pheno-error]');
const emptyNode=document.querySelector<HTMLElement>('[data-pheno-empty]');
const contentNode=document.querySelector<HTMLElement>('[data-pheno-content]');
const progressLabel=document.querySelector<HTMLElement>('[data-pheno-progress-label]');
const progressBar=document.querySelector<HTMLElement>('[data-pheno-progress-bar]');
const ageNode=document.querySelector<HTMLElement>('[data-pheno-age]');
const chronoNode=document.querySelector<HTMLElement>('[data-chrono-age]');
const differenceNode=document.querySelector<HTMLElement>('[data-age-difference]');
const labelNode=document.querySelector<HTMLElement>('[data-age-label]');
const explanationNode=document.querySelector<HTMLElement>('[data-pheno-explanation]');
if(!form||!errorNode||!emptyNode||!contentNode||!progressLabel||!progressBar||!ageNode||!chronoNode||!differenceNode||!labelNode||!explanationNode)return;
const safeForm=form,safeError=errorNode,safeEmpty=emptyNode,safeContent=contentNode;
const safeProgressLabel=progressLabel,safeProgressBar=progressBar;
const biomarkerInputs=Array.from(safeForm.querySelectorAll<HTMLInputElement>('input[required]'));
function parse(name:string):number{return Number(String(new FormData(safeForm).get(name)||'').replace(',','.'))}
function canonical(values:Values,units:Units):Values{return{...values,albumin:units.albuminUnit==='gdL'?values.albumin*10:values.albumin,creatinine:units.creatinineUnit==='mgdL'?values.creatinine*88.4:values.creatinine,glucose:units.glucoseUnit==='mgdL'?values.glucose/18:values.glucose,crp:units.crpUnit==='mgL'?values.crp/10:values.crp}}
function calculate(v:Values):number{const xb=-19.9067-0.0336*v.albumin+0.0095*v.creatinine+0.1953*v.glucose+0.0954*Math.log(v.crp)-0.012*v.lymphocyte+0.0268*v.mcv+0.3306*v.rdw+0.00188*v.alp+0.0554*v.wbc+0.0804*v.age;const mortality=1-Math.exp(-Math.exp(xb)*(Math.exp(120*0.0076927)-1)/0.0076927);return 141.50225+Math.log(-0.00553*Math.log(1-mortality))/0.090165}
function updateProgress():void{let complete=0;biomarkerInputs.forEach(input=>{const card=input.closest('.pheno-field');const valid=input.value.trim()!==''&&input.checkValidity();if(valid)complete+=1;if(card)card.classList.toggle('is-complete',valid)});safeProgressLabel.textContent=`${complete} / 10`;safeProgressBar.style.width=`${complete*10}%`}
biomarkerInputs.forEach(input=>{input.addEventListener('input',updateProgress);input.addEventListener('change',updateProgress)});updateProgress();
function showError(message:string):void{safeError.textContent=message;safeError.hidden=false;safeEmpty.hidden=false;safeContent.hidden=true}
safeForm.addEventListener('submit',event=>{event.preventDefault();safeError.hidden=true;const button=safeForm.querySelector<HTMLButtonElement>('[data-pheno-submit]');if(button)button.disabled=true;try{if(!safeForm.checkValidity()){showError('Uzupełnij wszystkie pola i sprawdź, czy wartości mieszczą się w dozwolonym zakresie.');safeForm.reportValidity();return}const values:Values={age:parse('age'),albumin:parse('albumin'),creatinine:parse('creatinine'),glucose:parse('glucose'),crp:parse('crp'),lymphocyte:parse('lymphocyte'),mcv:parse('mcv'),rdw:parse('rdw'),alp:parse('alp'),wbc:parse('wbc')};const data=new FormData(safeForm);const units:Units={albuminUnit:String(data.get('albuminUnit')),creatinineUnit:String(data.get('creatinineUnit')),glucoseUnit:String(data.get('glucoseUnit')),crpUnit:String(data.get('crpUnit'))};const normalized=canonical(values,units);if(normalized.crp<=0){showError('CRP musi być większe od zera, ponieważ wzór wykorzystuje logarytm tego wyniku.');return}const phenoAge=calculate(normalized);if(!Number.isFinite(phenoAge)){showError('Nie udało się obliczyć wyniku. Sprawdź wartości i jednostki.');return}const rounded=Math.round(phenoAge*10)/10;const difference=Math.round((rounded-values.age)*10)/10;safeEmpty.hidden=true;safeContent.hidden=false;ageNode.textContent=rounded.toFixed(1).replace('.',',');chronoNode.textContent=`${values.age} lat`;differenceNode.textContent=`${difference>0?'+':''}${difference.toFixed(1).replace('.',',')} lat`;if(difference<=-3){labelNode.textContent='niższy';explanationNode.textContent='Wynik jest niższy od wieku metrykalnego. Oznacza to korzystniejszy profil dziewięciu markerów w ramach tego modelu, ale nie dowodzi wolniejszego starzenia wszystkich narządów.'}else if(difference>=3){labelNode.textContent='wyższy';explanationNode.textContent='Wynik jest wyższy od wieku metrykalnego. Warto omówić poszczególne wyniki badań z lekarzem, zamiast próbować obniżać samą liczbę PhenoAge.'}else{labelNode.textContent='zbliżony';explanationNode.textContent='Wynik jest zbliżony do wieku metrykalnego. Najwięcej informacji daje obserwowanie markerów i ich trendu, nie pojedynczej wartości modelu.'}}finally{if(button)button.disabled=false}});
})();
