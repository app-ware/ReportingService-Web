import { Injectable, CanActivate, ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class CenterAccessGuard implements CanActivate {
    constructor(
        @InjectDataSource('isecure') 
        private readonly isecureDataSource: DataSource,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user; 
        const centerId = user?.centerId; 

        if (!user || !centerId) {
            throw new ForbiddenException('User or Center ID not provided');
        }
        
        if (!user || isNaN(centerId)) {
            throw new BadRequestException('Missing or invalid user or centerId');
        }
        const sqlQuery = `
            SELECT COUNT(*) as count 
            FROM Center_Users 
            WHERE ID = @0 AND center_id = @1
        `;

        const result = await this.isecureDataSource.query(sqlQuery, [user.sub, centerId]);
        const hasAccess = result[0]?.count > 0;

        if (!hasAccess) {
            throw new ForbiddenException('User not authorized for this center');
        }

        return true; 
    }
}