import { Component, type OnInit } from '@angular/core';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { PinchZoomModule } from '@meddv/ngx-pinch-zoom';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from '../../shared/services/user.service';
import { CurrencyPipe, DatePipe, formatDate } from '@angular/common';
import { AlertsService } from '../../shared/services/alerts.service';
import { NgSelectModule } from '@ng-select/ng-select';
import { EstablishmentService } from '../../shared/services/establishment.service';
import { InvoiceService } from '../../shared/services/invoice.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    HeaderComponent,
    PinchZoomModule,
    CurrencyPipe,
    NgSelectModule,
    DatePipe
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {

  form!: FormGroup;
  user = JSON.parse(localStorage.getItem('user') || '');
  rejectOptions!: string;
  establishments: any[] = [];
  loading = {
    reject: false,
    approve: false
  };
  currentClientData: any;

  constructor(
    private userService: UserService,
    private alertsService: AlertsService,
    private establishmentService: EstablishmentService,
    private invoiceService: InvoiceService
  ) { }
  ngOnInit(): void {
    this.loadForm();
    this.getAgentShopping();
    this.get();
  }

  get() {
    this.establishmentService.get().subscribe((response: any) => {
      console.log(response)
      this.establishments = response;
    })
  }

  loadForm(): void {
    this.form = new FormGroup({
      nit: new FormControl('', Validators.required),
      name: new FormControl('', Validators.required),
      date: new FormControl('', Validators.required),
      product: new FormControl('', Validators.required),
      value: new FormControl('', Validators.required),
      invoiceNumber: new FormControl('', Validators.required),
    });
  }

  getAgentShopping() {
    this.userService.getAgentShopping(this.user?.id).subscribe((response: any) => {
      console.log(response);
      this.currentClientData = response;
      const commerce = this.establishments.filter((establishment: any) => establishment.nit === this.clearNit(response?.nit)) || [];
      console.log(this.clearNit(response?.nit))
      this.form = new FormGroup({
        nit: new FormControl(response?.nit, Validators.required),
        name: new FormControl((commerce.length > 0) ? commerce[0].nameStore : response?.commerce, Validators.required),
        date: new FormControl(this.parseDate(response?.dateInvoice), Validators.required),
        product: new FormControl(response?.typeProduct, Validators.required),
        value: new FormControl(response?.price, Validators.required),
        invoiceNumber: new FormControl(response?.invoiceNumber, Validators.required),
      });
    })
  }

  setNameStore(nit: string) {
    const commerce = this.establishments.filter((establishment: any) => establishment.nit === nit) || [];
    if (commerce.length > 0) {
      this.form.get('name')?.setValue(commerce[0].nameStore);
    }
  }

  clearNit(nit: string) {
    const response = nit.split('-')[0].replace(/\./g, '');
    return response
  }

  parseDate(dateString: string): string {
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateString;
  }

  updateData(type: 'approve' | 'reject' | 'nextOne') {
    this.userService.updateAgentShopping(this.prepareData(type), this.currentClientData.id).subscribe({
      next: (response: any) => {
        console.log(response);
        const closeBtnModal = document.getElementById(type + 'Close');
        closeBtnModal?.click();
        if (type === 'approve') {
          this.userService.updatePoints({ idClient: this.currentClientData.idClient, purchaseValue: this.value?.value }).subscribe((response: any) => {
            console.log(response);
          })
        }

        if (type === 'reject') {
          this.userService.rejectInvoice({ idClient: this.currentClientData.idClient, rejectionMessage: this.rejectOptions }).subscribe((response: any) => {
            console.log(response);
          })
        }
        this.getInvoices();
        this.alertsService.success('Éxito', this.generateMessage(type));
        this.getAgentShopping();
      },
      error: (err) => {
        this.alertsService.error('Error', 'No se ha podido actualizar la factura, intentelo de nuevo.');
      }
    });
  }

  getInvoices(): void {
    this.userService.getInvoices().subscribe((response: any) => {
      this.invoiceService.updateInvoiceValue(response?.count);
    });
  }

  generateMessage(type: 'approve' | 'reject' | 'nextOne'): string {
    const messages = {
      'approve': 'Se ha aprobado la factura con exito.',
      'reject': 'Se ha rechazado la factura con exito.',
      'nextOne': 'Se ha saltado la factura con exito.'
    }
    return messages[type];
  }

  prepareData(type: 'approve' | 'reject' | 'nextOne'): any {
    const datas = {
      'approve': {
        "idClient": this.currentClientData?.id,
        "price": this.value?.value,
        "nit": this.nit?.value,
        "invoiceUrl": this.currentClientData?.invoiceUrl,
        "typeProduct": this.product?.value,
        "invoiceNumber": this.invoiceNumber?.value,
        "dateInvoice": this.currentClientData?.dateInvoice,
        "invoiceRead": 1,
        "idAgent": this.user?.id,
        "statusInvoice": 1,
        "commerce": this.name?.value
      },
      'reject': {
        'idAgent': this.user?.id,
        'statusInvoice': 1,
        'reasonReject': this.rejectOptions,
        'invoiceRead': 1
      },
      'nextOne': {
        'idAgent': null,
        'date': this.getLastWeek()
      }
    }
    return datas[type];
  }

  getLastWeek() {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
  }

  get nit() { return this.form.get('nit'); }
  get name() { return this.form.get('name'); }
  get date() { return this.form.get('date'); }
  get product() { return this.form.get('product'); }
  get value() { return this.form.get('value'); }
  get invoiceNumber() { return this.form.get('invoiceNumber'); }

}