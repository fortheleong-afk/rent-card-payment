export type Locale = 'en' | 'ko';
export type OrderSummary = { application_id?:string; payment_status:string; payout_status:string };
export type Journey = { key:string; title:string; description:string; next:string; tone:'neutral'|'info'|'warning'|'success'; stage:number };
export const paymentText = {
 en:{pending:'Awaiting test payment',paid:'Test payment complete',failed:'Test payment failed',cancelled:'Payment cancelled',refunded:'Test refund complete'},
 ko:{pending:'테스트 결제 대기',paid:'테스트 결제 완료',failed:'테스트 결제 실패',cancelled:'결제 취소',refunded:'테스트 환불 완료'},
};
export const payoutText = {
 en:{not_ready:'Payment required first',pending:'Awaiting test payout',processing:'Test payout in progress',completed:'Test payout complete',failed:'Test payout failed',cancelled:'Payout cancelled'},
 ko:{not_ready:'결제 완료 전',pending:'테스트 지급 대기',processing:'테스트 지급 처리 중',completed:'테스트 지급 완료',failed:'테스트 지급 실패',cancelled:'지급 취소'},
};
export function getJourney(status:string, order:OrderSummary|null|undefined, locale:Locale='en'):Journey {
 const ko=locale==='ko';
 const make=(key:string,tone:Journey['tone'],stage:number,en:string[],kr:string[]):Journey=>{
  const [title,description,next]=ko?kr:en; return {key,title,description,next,tone,stage};
 };
 if(status==='pending_review')return make('review','info',0,
  ['Under review','Your application is with the review team.','No action needed. Check your submitted details or wait for an update.'],
  ['심사 대기','계약서와 신청 정보를 확인해야 합니다.','계약서를 열고 금액·임대인 정보를 검토한 뒤 승인 또는 반려하세요.']);
 if(status==='rejected')return make('rejected','warning',0,
  ['Application declined','This application did not pass review.','Read the review reason below. You can submit a new application with corrected details.'],
  ['심사 반려','해당 신청의 심사가 종료됐습니다.','반려 사유와 제출 자료를 확인하세요. 새 신청은 별도로 접수됩니다.']);
 if(status==='cancelled')return make('cancelled','neutral',0,
  ['Application cancelled','This application is closed.','Start a new application if you still need to arrange rent payment.'],
  ['신청 취소','사용자가 신청을 취소했습니다.','추가 심사 작업이 없습니다. 기존 자료와 이력은 확인할 수 있습니다.']);
 if(status==='approved'){
  if(!order)return make('ready','info',1,
   ['Approved · ready for a test order','Your application has passed review.','Create a test order below to confirm the amount. This will not charge your card.'],
   ['주문 생성 필요','심사가 승인됐으며 아직 결제 주문이 없습니다.','금액을 확인하고 테스트 주문을 생성하세요.']);
  if(order.payment_status==='refunded'||order.payment_status==='cancelled')return make('closed','neutral',1,
   [order.payment_status==='refunded'?'Test refund complete':'Test payment cancelled','This test order is closed.','No further action is needed. Contact support if you have questions.'],
   [order.payment_status==='refunded'?'테스트 환불 완료':'테스트 결제 취소','결제 주문이 종료됐습니다.','필요하면 시뮬레이터에서 이력을 보존한 채 초기화할 수 있습니다.']);
  if(order.payment_status==='failed')return make('payment_failed','warning',1,
   ['Test payment failed','No successful payment is recorded.','Contact support for the next test attempt. Do not create a second order.'],
   ['결제 실패 확인 필요','테스트 결제가 실패했습니다.','주문 이력을 확인하고 시뮬레이터에서 결제 재시도를 테스트하세요.']);
  if(order.payment_status==='pending')return make('payment','info',1,
   ['Awaiting test payment','Your test order is ready. Your card has not been charged.','The operator can run a payment simulation. You do not need to enter card details.'],
   ['테스트 결제 대기','주문이 생성됐으며 아직 결제되지 않았습니다.','시뮬레이터를 열어 결제 성공·실패·취소를 테스트하세요.']);
  if(order.payment_status==='paid'){
   if(order.payout_status==='completed')return make('complete','success',3,
    ['Test payout complete','The payment and landlord payout simulation are complete.','Review the test history below. No real money was transferred.'],
    ['테스트 지급 완료','결제와 임대인 지급 시뮬레이션이 완료됐습니다.','추가 처리 없이 이력을 확인하거나 새로운 테스트를 위해 초기화하세요.']);
   if(order.payout_status==='failed'||order.payout_status==='cancelled')return make('payout_attention','warning',2,
    [order.payout_status==='failed'?'Test payout failed':'Test payout cancelled','Test payment is complete, but the landlord payout is not complete.','Do not pay again. The operator needs to review the payout.'],
    [order.payout_status==='failed'?'지급 실패 확인 필요':'지급 취소 확인 필요','결제 완료 상태이며 임대인 지급은 완료되지 않았습니다.','중복 결제 없이 지급 재시도 또는 결제 취소·환불 테스트를 진행하세요.']);
   if(order.payout_status==='processing')return make('payout_processing','info',2,
    ['Test payout in progress','Test payment is complete. The payout simulation is in progress.','No action needed. Wait for the operator to complete the test.'],
    ['테스트 지급 처리 중','결제는 완료됐으며 지급 결과를 기다리고 있습니다.','시뮬레이터에서 지급 성공 또는 실패를 처리하세요.']);
   if(order.payout_status==='pending')return make('payout','info',2,
    ['Awaiting test payout','Test payment is complete. The landlord payout has not started.','No action needed. Do not submit another payment.'],
    ['테스트 지급 대기','결제는 완료됐으며 임대인 지급을 시작할 차례입니다.','시뮬레이터에서 지급 시작을 실행하세요.']);
  }
 }
 return make('legacy','neutral',0,
  ['Status needs confirmation','This application uses an earlier workflow.','Contact support to confirm its current status.'],
  ['상태 확인 필요','이전 처리 방식이거나 예상하지 못한 상태입니다.','신청·주문 이력을 확인한 뒤 처리 상태를 확인하세요.']);
}
export function statusText(value:string, kind:'payment'|'payout', locale:Locale):string {
 const map=kind==='payment'?paymentText[locale]:payoutText[locale];return (map as Record<string,string>)[value]??value;
}
