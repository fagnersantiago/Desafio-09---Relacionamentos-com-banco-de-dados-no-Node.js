import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExist = await this.customersRepository.findById(customer_id);

    if (!customerExist) {
      throw new AppError('Could not find any customer with the given ids');
    }

    const existentProduct = await this.productsRepository.findAllById(products);

    if (!existentProduct.length) {
      throw new AppError('Could not find any products with the given ids');
    }

    const existentProductIds = existentProduct.map(product => product.id);

    const checkInexistentProducts = products.filter(
      product => !existentProductIds.includes(product.id),
    );

    if (checkInexistentProducts.length) {
      throw new AppError(
        `Could not find products${checkInexistentProducts[0].id}`,
      );
    }

    const findProductWithNoQuantityAvailable = products.filter(product =>
      existentProduct.filter(p => p.id === product.id)[0].quantity< product.quantity,
    );

    if(findProductWithNoQuantityAvailable.length){
      throw new AppError(
        `The quantity ${findProductWithNoQuantityAvailable[0].id} is not available for ${findProductWithNoQuantityAvailable} `,
      );
    }


    const serializeProducts = products.map(product =>({
      product_id: product.id,
      quantity: product.quantity,
      price:  existentProduct.filter(p=>p.id === product.id)[0].price
    }));

    const order = await this.ordersRepository.create({
      customer: customerExist,
      products: serializeProducts
    });

    const {order_products} = order;

    const orderProductsQuantity =  order_products.map(product =>({
      id: product.product_id,
      quantity: existentProduct.filter(p=> p.id === product.product_id)[0].quantity - product.quantity
    }));

    await this.productsRepository.updateQuantity( orderProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
